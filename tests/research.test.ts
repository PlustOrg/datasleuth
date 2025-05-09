import { research } from '../src/core/research';
import { createBasicSchema, createMockState } from './test-utils';
import { z } from 'zod';

describe('research()', () => {
  // Increase timeout for all tests to 30 seconds
  jest.setTimeout(30000);
  
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should validate input and output schemas correctly', async () => {
    const input = {
      query: 'Test query',
      outputSchema: z.object({ message: z.string() }),
    };

    const result = await research(input);

    expect(result).toEqual({ message: 'Research completed successfully!' });
  });

  it('should throw an error for invalid input schema', async () => {
    // Use as any to bypass TypeScript checking for test purposes
    // This is intentional as we're testing runtime validation behavior
    const input = {
      query: 123, // Invalid type
      outputSchema: z.object({ message: z.string() }),
    } as any;

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