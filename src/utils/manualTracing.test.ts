import { ManualTracer } from './manualTracing';

describe('GlobalDurationTimer', () => {
  function timeout(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
  test('ManualTracer => simple flow', async () => {
    ManualTracer.startTrace("A");
    await timeout(10);
    ManualTracer.stopTrace("A");
    ManualTracer.startTrace("B");
    await timeout(20);
    ManualTracer.stopTrace("B");
    const traces = ManualTracer.getTraces();
    const A = traces.find(t => t.name === "A")
    const B = traces.find(t => t.name === "B")
    expect(A.name).toEqual("A");
    expect(A.endTime - A.startTime).toEqual("A");
    expect(B.name).toEqual("B");
  });
});
