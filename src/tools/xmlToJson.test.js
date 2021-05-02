import { traverse } from './xmlToJson';

const clean = function cleanXML(xml) {
  return xml
    .replace(/>\s*</g, '><') //remove white spaces between elements
    .replace(/<\?xml.*\?>/g, '') //remove the root element
    .replace(/<!--.*-->/g, '') //remove comments
    .replace(/>\s*/g, '>') // remove any white spaces at the end of the xml string if any
    .replace(/\s*</g, '<'); // remove any white spaces that are left at the beginning of the xml string
};

// noinspection HtmlUnknownTag
let mockData = {
  TEST1: '<employee id="12345" building="1" geo="US"><name>Alex</name></employee>',
  TEST2:
    '<employee id="12345"><name>Alex</name></employee><employee id="56789"><name>Jon</name></employee>',
  TEST3: '<employee><name>Alex</name><age>25</age></employee>',
  TEST4: '<employee id="12345"></employee>',
  TEST5:
    '<employee name="Alex"></employee><role>Software Dev</role><locality country="US" region="TX" city="Austin"></locality>',
  TEST6:
    '<employee id="12345"><name type="first">Alex</name><name type="last">La Bianca</name></employee><employee id="98765"><name type="first">Ash</name><name type="last">Thrasher</name></employee><employee id="12332"><name type="first">Jon</name><name type="last">Andrews</name></employee>',
  TEST7:
    '<xml><employee id="123" name="alex"></employee><employee id="456" name="jon"></employee><employee id="789" name="ashley"></employee></xml>',
  TEST8:
    '<xml><employee><name>Alex</name></employee><location>US</location><employee><name>Troy</name></employee></xml>',
  TEST9: '<employee id="98765">Alex</employee>',
  //Invalid XML

  TEST10: '<employee>Alex</employee', // prettier-ignore
  TEST11: '<employee id="98765">Alex<employee>',
  TEST12: '<employee id="98765"><employee id="12345">Jon<employee></employee>',
  //nested repetition
  TEST13: '<employee id="98765" name="alex"><employee id="123" name="jon"></employee></employee>',
  TEST14: '<employee id="98765" name="alex"><employee>Alex</employee></employee>',
  TEST15:
    '<aaa> <bbb> <bbb1>ccc</bbb1> <yyy>yyy</yyy> </bbb> <bbb> <ddd>ddd</ddd> <yyy>yyy</yyy> </bbb> </aaa>',
  TEST16:
    '<aaa><bbb><ccc>ccc</ccc><bbb1>bbb1</bbb1></bbb><bbb><ddd>ddd</ddd><bbb2>bbb2</bbb2></bbb></aaa>',
  TEST17:
    '<aaa><bbb locale="Austin"><ccc>ccc</ccc><bbb1 locale="Berlin">bbb1</bbb1></bbb><bbb locale="San Francisco"><ddd>ddd</ddd><bbb2 locale="London">bbb2</bbb2></bbb></aaa>',
};
mockData.I_TEST10 = mockData.TEST10;
mockData.I_TEST11 = mockData.TEST11;
mockData.I_TEST12 = mockData.TEST12;

describe('TRAVERSE: With Attributes', () => {
  const attributeMode = true;

  it('should collect all 3 attributes of the "employee" tag', () => {
    const cleanXML = clean(mockData.TEST1);
    const json = traverse(cleanXML, attributeMode);

    const result = {
      employee: {
        id: '12345',
        building: '1',
        geo: 'US',
        name: 'Alex',
      },
    };

    expect(JSON.stringify(json)).toBe(JSON.stringify(result));
  });

  it('should create an array if the same tag exist on the same level', () => {
    //const cleanXML = mockData.TEST2.replace(/>\s*</g, '><');
    const cleanXML = clean(mockData.TEST2);
    const json = traverse(cleanXML, attributeMode);

    const result = {
      employee: [
        {
          id: '12345',
          name: 'Alex',
        },
        {
          id: '56789',
          name: 'Jon',
        },
      ],
    };

    expect(JSON.stringify(json)).toBe(JSON.stringify(result));
  });

  it('should parse xml without attributes even if attributeMode is enabled', () => {
    const cleanXML = clean(mockData.TEST3);
    const json = traverse(cleanXML, attributeMode);

    const result = {
      employee: {
        name: 'Alex',
        age: '25',
      },
    };

    expect(JSON.stringify(json)).toBe(JSON.stringify(result));
  });

  it('should read the single attribute', () => {
    const cleanXML = clean(mockData.TEST4);
    const json = traverse(cleanXML, attributeMode);

    const result = {
      employee: {
        id: '12345',
      },
    };

    expect(JSON.stringify(json)).toBe(JSON.stringify(result));
  });

  it('should pass sanity check', () => {
    const cleanXML = clean(mockData.TEST5);
    const converted = traverse(cleanXML, attributeMode);

    const result = {
      employee: {
        name: 'Alex',
      },
      role: 'Software Dev',
      locality: {
        country: 'US',
        region: 'TX',
        city: 'Austin',
      },
    };

    expect(JSON.stringify(converted)).toBe(JSON.stringify(result));
  });

  it('should create an array of employees where each contain an array of names', () => {
    const cleanXML = clean(mockData.TEST6);
    const json = traverse(cleanXML, attributeMode);

    const result = {
      employee: [
        {
          id: '12345',
          name: [
            { type: 'first', textNode: 'Alex' },
            { type: 'last', textNode: 'La Bianca' },
          ],
        },
        {
          id: '98765',
          name: [
            { type: 'first', textNode: 'Ash' },
            { type: 'last', textNode: 'Thrasher' },
          ],
        },
        {
          id: '12332',
          name: [
            { type: 'first', textNode: 'Jon' },
            { type: 'last', textNode: 'Andrews' },
          ],
        },
      ],
    };

    expect(JSON.stringify(json)).toBe(JSON.stringify(result));
  });

  it('should create an object with xml key that contains one property which is an array of length 3', () => {
    const cleanXML = clean(mockData.TEST7);
    const json = traverse(cleanXML, attributeMode);

    const result = {
      xml: {
        employee: [
          {
            id: '123',
            name: 'alex',
          },
          {
            id: '456',
            name: 'jon',
          },
          {
            id: '789',
            name: 'ashley',
          },
        ],
      },
    };

    expect(JSON.stringify(json)).toBe(JSON.stringify(result));
  });

  it('should process an array like element if it is out of order', () => {
    const cleanXML = clean(mockData.TEST8);
    const json = traverse(cleanXML, attributeMode);

    const result = {
      xml: {
        employee: [{ name: 'Alex' }, { name: 'Troy' }],
        location: 'US',
      },
    };

    expect(JSON.stringify(json)).toBe(JSON.stringify(result));
  });

  it('should process a single xml element', () => {
    const cleanXML = clean(mockData.TEST9);
    const json = traverse(cleanXML, attributeMode);

    const result = {
      employee: {
        id: '98765',
        textNode: 'Alex',
      },
    };

    expect(JSON.stringify(json)).toBe(JSON.stringify(result));
  });
});

describe('TRAVERSE: Without Attributes', () => {
  const attributeMode = false;

  it('should not collect any attributes', () => {
    const cleanXML = clean(mockData.TEST1);
    const json = traverse(cleanXML, attributeMode);

    const result = {
      employee: {
        name: 'Alex',
      },
    };

    expect(JSON.stringify(json)).toBe(JSON.stringify(result));
  });

  it('should creeate an array', () => {
    const cleanXML = clean(mockData.TEST2);
    const json = traverse(cleanXML, attributeMode);

    const result = {
      employee: [
        {
          name: 'Alex',
        },
        {
          name: 'Jon',
        },
      ],
    };

    expect(JSON.stringify(json)).toBe(JSON.stringify(result));
  });

  it('should not read the single attribute', () => {
    const cleanXML = clean(mockData.TEST4);
    const json = traverse(cleanXML, attributeMode);

    const result = {
      employee: '',
    };

    expect(JSON.stringify(json)).toBe(JSON.stringify(result));
  });

  it('should create an array of employees where each contain an array of names', () => {
    const cleanXML = clean(mockData.TEST6);
    const json = traverse(cleanXML, attributeMode);

    const result = {
      employee: [
        {
          name: ['Alex', 'La Bianca'],
        },
        {
          name: ['Ash', 'Thrasher'],
        },
        {
          name: ['Jon', 'Andrews'],
        },
      ],
    };

    expect(JSON.stringify(json)).toBe(JSON.stringify(result));
  });

  it('should create an object with xml key that contains one property which is an array of length 3', () => {
    const cleanXML = clean(mockData.TEST7);
    const json = traverse(cleanXML, attributeMode);

    const result = {
      xml: {
        employee: '',
      },
    };

    expect(JSON.stringify(json)).toBe(JSON.stringify(result));
  });

  it('should process a single xml element', () => {
    const cleanXML = clean(mockData.TEST9);
    const json = traverse(cleanXML, attributeMode);

    const result = {
      employee: 'Alex',
    };

    expect(JSON.stringify(json)).toBe(JSON.stringify(result));
  });
});

describe('ERRORS: Invalid XML', () => {
  const attributeMode = true;

  it('should throw an error with invalid xml 1', () => {
    const cleanXML = clean(mockData.I_TEST10);
    traverse(cleanXML, attributeMode);
    expect(traverse(cleanXML, attributeMode)).toEqual({});
  });

  it('should throw an error with invalid xml 2', () => {
    const cleanXML = clean(mockData.I_TEST11);
    expect(traverse(cleanXML, attributeMode)).toEqual({});
  });

  it('should throw an error with invalid xml 3', () => {
    const cleanXML = clean(mockData.I_TEST12);
    expect(traverse(cleanXML, attributeMode)).toEqual({
      employee: {
        id: '98765',
      },
    });
  });
});

describe('NESTING: Repetions', () => {
  const attributeMode = true;

  it('should correctly parse nested repeated xml tags', () => {
    const cleanXML = clean(mockData.TEST13);
    const json = traverse(cleanXML, attributeMode);

    const result = {
      employee: {
        id: '98765',
        name: 'alex',
        employee: {
          id: '123',
          name: 'jon',
        },
      },
    };

    expect(JSON.stringify(json)).toBe(JSON.stringify(result));
  });

  it('should throw an error with invalid xml 2', () => {
    const cleanXML = clean(mockData.TEST14);
    const json = traverse(cleanXML, attributeMode);

    const result = {
      employee: {
        id: '98765',
        name: 'alex',
        employee: 'Alex',
      },
    };

    expect(JSON.stringify(json)).toBe(JSON.stringify(result));
  });

  it('should distinguish between similar tags (<bbb> vs. <bbb1>)', () => {
    const cleanXML = clean(mockData.TEST15);
    const json = traverse(cleanXML, attributeMode);

    const result = {
      aaa: {
        bbb: [
          {
            bbb1: 'ccc',
            yyy: 'yyy',
          },
          {
            ddd: 'ddd',
            yyy: 'yyy',
          },
        ],
      },
    };

    expect(JSON.stringify(json)).toBe(JSON.stringify(result));
  });

  it('should distinguis between similar tags [2] (<bbb> vs <bbb1>)', () => {
    const cleanXML = clean(mockData.TEST16);
    const json = traverse(cleanXML, attributeMode);

    const result = {
      aaa: {
        bbb: [
          {
            ccc: 'ccc',
            bbb1: 'bbb1',
          },
          {
            ddd: 'ddd',
            bbb2: 'bbb2',
          },
        ],
      },
    };

    expect(JSON.stringify(json)).toBe(JSON.stringify(result));
  });

  it('should distinguis between similar tags [3] [attribute=true] (<bbb> vs <bbb1>)', () => {
    const cleanXML = clean(mockData.TEST17);
    const json = traverse(cleanXML, attributeMode);

    const result = {
      aaa: {
        bbb: [
          {
            locale: 'Austin',
            ccc: 'ccc',
            bbb1: {
              locale: 'Berlin',
              textNode: 'bbb1',
            },
          },
          {
            locale: 'San Francisco',
            ddd: 'ddd',
            bbb2: {
              locale: 'London',
              textNode: 'bbb2',
            },
          },
        ],
      },
    };

    expect(JSON.stringify(json)).toBe(JSON.stringify(result));
  });
});
