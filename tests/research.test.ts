import { research } from '../src/core/research';
import { z } from 'zod';

describe('research()', () => {
  it('should validate input and output schemas correctly', async () => {
    const input = {
      query: 'Test query',
      outputSchema: z.object({ message: z.string() }),
    };

    const result = await research(input);

    expect(result).toEqual({ message: 'Research completed successfully!' });
  });

  it('should throw an error for invalid input schema', async () => {
    const input = {
      query: 123, // Invalid type
      outputSchema: z.object({ message: z.string() }),
    };

    await expect(research(input)).rejects.toThrow();
  });

  it('should throw an error for invalid output schema', async () => {
    const input = {
      query: 'Test query',
      outputSchema: z.object({ invalidKey: z.string() }),
    };

    await expect(research(input)).rejects.toThrow();
  });
});