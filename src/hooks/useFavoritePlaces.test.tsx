import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const storageMocks = vi.hoisted(() => ({
  readJsonValue: vi.fn(),
  writeJsonValue: vi.fn(),
}));

vi.mock("@/lib/jsonFileStorage", () => ({
  readJsonValue: storageMocks.readJsonValue,
  writeJsonValue: storageMocks.writeJsonValue,
}));

vi.mock("@/lib/uuid", () => ({
  generateId: () => "place-id",
}));

import { useFavoritePlaces } from "./useFavoritePlaces";

describe("useFavoritePlaces", () => {
  beforeEach(() => {
    storageMocks.readJsonValue.mockResolvedValue([]);
    storageMocks.writeJsonValue.mockResolvedValue(undefined);
    storageMocks.readJsonValue.mockClear();
    storageMocks.writeJsonValue.mockClear();
  });

  it("loads only valid stored places", async () => {
    storageMocks.readJsonValue.mockResolvedValue([
      { id: "ok", name: "Home", location: { lat: 28.1, lng: -15.4 } },
      { id: "bad", name: "Bad", location: { lat: Number.NaN, lng: 1 } },
    ]);

    const { result } = renderHook(() => useFavoritePlaces());
    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.places).toEqual([{ id: "ok", name: "Home", location: { lat: 28.1, lng: -15.4 } }]);
  });

  it("adds trimmed valid places and ignores invalid input", async () => {
    const { result } = renderHook(() => useFavoritePlaces());
    await act(async () => {
      await Promise.resolve();
    });

    act(() => {
      result.current.addPlace("  Office  ", { lat: 1, lng: 2 });
      result.current.addPlace("   ", { lat: 1, lng: 2 });
      result.current.addPlace("Bad", { lat: Number.NaN, lng: 2 });
    });

    expect(result.current.places).toEqual([{ id: "place-id", name: "Office", location: { lat: 1, lng: 2 } }]);
    expect(storageMocks.writeJsonValue).toHaveBeenCalledWith("favorite-places", result.current.places);
  });

  it("deletes places by id", async () => {
    storageMocks.readJsonValue.mockResolvedValue([{ id: "ok", name: "Home", location: { lat: 1, lng: 2 } }]);
    const { result } = renderHook(() => useFavoritePlaces());
    await act(async () => {
      await Promise.resolve();
    });

    act(() => {
      result.current.deletePlace("ok");
    });

    expect(result.current.places).toEqual([]);
  });
});
