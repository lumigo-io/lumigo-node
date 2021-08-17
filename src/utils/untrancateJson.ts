// copied from https://www.npmjs.com/package/untruncate-json
enum ContextType {
  TOP_LEVEL = 'topLevel',
  STRING = 'string',
  STRING_ESCAPED = 'stringEscaped',
  STRING_UNICODE = 'stringUnicode',
  NUMBER = 'number',
  NUMBER_NEEDS_DIGIT = 'numberNeedsDigit',
  NUMBER_NEEDS_EXPONENT = 'numberNeedsExponent',
  TRUE = 'true',
  FALSE = 'false',
  NULL = 'null',
  ARRAY_NEEDS_VALUE = 'arrayNeedsValue',
  ARRAY_NEEDS_COMMA = 'arrayNeedsComma',
  OBJECT_NEEDS_KEY = 'objectNeedsKey',
  OBJECT_NEEDS_COLON = 'objectNeedsColon',
  OBJECT_NEEDS_VALUE = 'objectNeedsValue',
  OBJECT_NEEDS_COMMA = 'objectNeedsComma',
}

enum RespawnReason {
  STRING_ESCAPE = 'stringEscape',
  COLLECTION_ITEM = 'collectionItem',
}

function isWhitespace(char: string): boolean {
  return '\u0020\u000D\u000A\u0009'.indexOf(char) >= 0;
}

export default function untruncateJson(json: string): string {
  const contextStack: ContextType[] = [ContextType.TOP_LEVEL];
  let position = 0;
  let respawnPosition: number | undefined;
  let respawnStackLength: number | undefined;
  let respawnReason: RespawnReason | undefined;

  const push = (context: ContextType) => contextStack.push(context);
  const replace = (context: ContextType) => (contextStack[contextStack.length - 1] = context);
  const setRespawn = (reason: RespawnReason) => {
    if (respawnPosition == null) {
      respawnPosition = position;
      respawnStackLength = contextStack.length;
      respawnReason = reason;
    }
  };
  const clearRespawn = (reason: RespawnReason) => {
    if (reason === respawnReason) {
      respawnPosition = undefined;
      respawnStackLength = undefined;
      respawnReason = undefined;
    }
  };
  const pop = () => contextStack.pop();
  const dontConsumeCharacter = () => position--;

  const startAny = (char: string) => {
    if ('0' <= char && char <= '9') {
      push(ContextType.NUMBER);
      return;
    }
    switch (char) {
      case '"':
        push(ContextType.STRING);
        return;
      case '-':
        push(ContextType.NUMBER_NEEDS_DIGIT);
        return;
      case 't':
        push(ContextType.TRUE);
        return;
      case 'f':
        push(ContextType.FALSE);
        return;
      case 'n':
        push(ContextType.NULL);
        return;
      case '[':
        push(ContextType.ARRAY_NEEDS_VALUE);
        return;
      case '{':
        push(ContextType.OBJECT_NEEDS_KEY);
        return;
    }
  };

  for (const { length } = json; position < length; position++) {
    const char = json[position];
    switch (contextStack[contextStack.length - 1]) {
      case ContextType.TOP_LEVEL:
        startAny(char);
        break;
      case ContextType.STRING:
        switch (char) {
          case '"':
            pop();
            break;
          case '\\':
            setRespawn(RespawnReason.STRING_ESCAPE);
            push(ContextType.STRING_ESCAPED);
            break;
        }
        break;
      case ContextType.STRING_ESCAPED:
        if (char === 'u') {
          push(ContextType.STRING_UNICODE);
        } else {
          clearRespawn(RespawnReason.STRING_ESCAPE);
          pop();
        }
        break;
      case ContextType.STRING_UNICODE:
        if (position - json.lastIndexOf('u', position) === 4) {
          clearRespawn(RespawnReason.STRING_ESCAPE);
          pop();
        }
        break;
      case ContextType.NUMBER:
        if (char === '.') {
          replace(ContextType.NUMBER_NEEDS_DIGIT);
        } else if (char === 'e' || char === 'E') {
          replace(ContextType.NUMBER_NEEDS_EXPONENT);
        } else if (char < '0' || char > '9') {
          dontConsumeCharacter();
          pop();
        }
        break;
      case ContextType.NUMBER_NEEDS_DIGIT:
        replace(ContextType.NUMBER);
        break;
      case ContextType.NUMBER_NEEDS_EXPONENT:
        if (char === '+' || char === '-') {
          replace(ContextType.NUMBER_NEEDS_DIGIT);
        } else {
          replace(ContextType.NUMBER);
        }
        break;
      case ContextType.TRUE:
      case ContextType.FALSE:
      case ContextType.NULL:
        if (char < 'a' || char > 'z') {
          dontConsumeCharacter();
          pop();
        }
        break;
      case ContextType.ARRAY_NEEDS_VALUE:
        if (char === ']') {
          pop();
        } else if (!isWhitespace(char)) {
          clearRespawn(RespawnReason.COLLECTION_ITEM);
          replace(ContextType.ARRAY_NEEDS_COMMA);
          startAny(char);
        }
        break;
      case ContextType.ARRAY_NEEDS_COMMA:
        if (char === ']') {
          pop();
        } else if (char === ',') {
          setRespawn(RespawnReason.COLLECTION_ITEM);
          replace(ContextType.ARRAY_NEEDS_VALUE);
        }
        break;
      case ContextType.OBJECT_NEEDS_KEY:
        if (char === '}') {
          pop();
        } else if (char === '"') {
          setRespawn(RespawnReason.COLLECTION_ITEM);
          replace(ContextType.OBJECT_NEEDS_COLON);
          push(ContextType.STRING);
        }
        break;
      case ContextType.OBJECT_NEEDS_COLON:
        if (char === ':') {
          replace(ContextType.OBJECT_NEEDS_VALUE);
        }
        break;
      case ContextType.OBJECT_NEEDS_VALUE:
        if (!isWhitespace(char)) {
          clearRespawn(RespawnReason.COLLECTION_ITEM);
          replace(ContextType.OBJECT_NEEDS_COMMA);
          startAny(char);
        }
        break;
      case ContextType.OBJECT_NEEDS_COMMA:
        if (char === '}') {
          pop();
        } else if (char === ',') {
          setRespawn(RespawnReason.COLLECTION_ITEM);
          replace(ContextType.OBJECT_NEEDS_KEY);
        }
        break;
    }
  }

  if (respawnStackLength != null) {
    contextStack.length = respawnStackLength;
  }
  const result = [respawnPosition != null ? json.slice(0, respawnPosition) : json];
  const finishWord = (word: string) =>
    result.push(word.slice(json.length - json.lastIndexOf(word[0])));
  for (let i = contextStack.length - 1; i >= 0; i--) {
    switch (contextStack[i]) {
      case ContextType.STRING:
        result.push('"');
        break;
      case ContextType.NUMBER_NEEDS_DIGIT:
      case ContextType.NUMBER_NEEDS_EXPONENT:
        result.push('0');
        break;
      case ContextType.TRUE:
        finishWord('true');
        break;
      case ContextType.FALSE:
        finishWord('false');
        break;
      case ContextType.NULL:
        finishWord('null');
        break;
      case ContextType.ARRAY_NEEDS_VALUE:
      case ContextType.ARRAY_NEEDS_COMMA:
        result.push(']');
        break;
      case ContextType.OBJECT_NEEDS_KEY:
      case ContextType.OBJECT_NEEDS_COLON:
      case ContextType.OBJECT_NEEDS_VALUE:
      case ContextType.OBJECT_NEEDS_COMMA:
        result.push('}');
        break;
    }
  }
  return result.join('');
}
