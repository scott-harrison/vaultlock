import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createLoginFieldScanner, mutationRecordsRequireRescan } from "./loginFieldScanner";

describe("mutationRecordsRequireRescan", () => {
  it("returns true when login inputs are added or removed", () => {
    const added = {
      type: "childList",
      addedNodes: [{}],
      removedNodes: [],
    } as MutationRecord;

    expect(mutationRecordsRequireRescan([added])).toBe(true);
  });

  it("returns true when input attributes change", () => {
    const attributeChange = {
      type: "attributes",
      target: { tagName: "INPUT" } as HTMLInputElement,
      attributeName: "type",
    } as MutationRecord;

    expect(mutationRecordsRequireRescan([attributeChange])).toBe(true);
  });

  it("returns true when container visibility attributes change", () => {
    const attributeChange = {
      type: "attributes",
      target: { tagName: "DIV" } as Element,
      attributeName: "class",
    } as MutationRecord;

    expect(mutationRecordsRequireRescan([attributeChange])).toBe(true);
  });

  it("ignores unrelated attribute mutations on non-login elements", () => {
    const attributeChange = {
      type: "attributes",
      target: { tagName: "DIV" } as Element,
      attributeName: "data-testid",
    } as MutationRecord;

    expect(mutationRecordsRequireRescan([attributeChange])).toBe(false);
  });
});

describe("createLoginFieldScanner", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("debounces mutation-driven scans", () => {
    const scan = vi.fn();
    const scanner = createLoginFieldScanner({
      scan,
      isContextValid: () => true,
      mutationDebounceMs: 100,
    });

    scanner.scheduleMutationScan();
    scanner.scheduleMutationScan();
    expect(scan).not.toHaveBeenCalled();

    vi.advanceTimersByTime(99);
    expect(scan).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(scan).toHaveBeenCalledTimes(1);
  });

  it("debounces input-driven scans separately from mutation scans", () => {
    const scan = vi.fn();
    const scanner = createLoginFieldScanner({
      scan,
      isContextValid: () => true,
      mutationDebounceMs: 100,
      inputDebounceMs: 50,
    });

    scanner.scheduleInputScan();
    vi.advanceTimersByTime(50);
    expect(scan).toHaveBeenCalledTimes(1);

    scanner.scheduleMutationScan();
    vi.advanceTimersByTime(100);
    expect(scan).toHaveBeenCalledTimes(2);
  });
});
