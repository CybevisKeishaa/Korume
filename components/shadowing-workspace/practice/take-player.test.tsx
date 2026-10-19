import { createRef } from "react";
import { act, fireEvent, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "@/test/render";
import { TakePlayer } from "./take-player";

let play: ReturnType<typeof vi.fn>;
let pause: ReturnType<typeof vi.fn>;
beforeEach(() => {
  play = vi.fn(function (this: HTMLMediaElement) { this.dispatchEvent(new Event("play")); return Promise.resolve(); });
  pause = vi.fn(function (this: HTMLMediaElement) { this.dispatchEvent(new Event("pause")); });
  vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(play as never);
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(pause as never);
});
afterEach(() => vi.restoreAllMocks());

function loaded(audio: HTMLAudioElement, duration: number) {
  Object.defineProperty(audio, "duration", { configurable: true, value: duration });
  act(() => { audio.dispatchEvent(new Event("loadedmetadata")); });
}

describe("TakePlayer", () => {
  it("replaces the browser's audio bar with a themed play button, seek bar and time", () => {
    const { container } = render(<TakePlayer src="/take.wav" label="Play my take" />);
    const audio = container.querySelector("audio");
    expect(audio).toHaveAttribute("src", "/take.wav");
    expect(audio).not.toHaveAttribute("controls");
    loaded(audio as HTMLAudioElement, 5.4);
    expect(screen.getByRole("button", { name: "Play my take" })).toBeInTheDocument();
    expect(screen.getByRole("slider", { name: "Position" })).toHaveAttribute("aria-valuetext", "0:00 / 0:05");
    expect(screen.getByText("0:00 / 0:05")).toBeInTheDocument();
  });

  it("plays and pauses from the one button, and calls onPlay so the lesson video can pause", async () => {
    const onPlay = vi.fn();
    render(<TakePlayer src="/take.wav" label="Play my take" onPlay={onPlay} />);
    fireEvent.click(screen.getByRole("button", { name: "Play my take" }));
    expect(play).toHaveBeenCalledTimes(1);
    expect(onPlay).toHaveBeenCalledTimes(1);
    fireEvent.click(await screen.findByRole("button", { name: "Pause" }));
    expect(pause).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Play my take" })).toBeInTheDocument();
  });

  it("seeks from the bar and follows the playhead", () => {
    const { container } = render(<TakePlayer src="/take.wav" label="Play my take" />);
    const audio = container.querySelector("audio") as HTMLAudioElement;
    loaded(audio, 10);
    fireEvent.change(screen.getByRole("slider", { name: "Position" }), { target: { value: "4" } });
    expect(audio.currentTime).toBe(4);
    act(() => { audio.currentTime = 7; audio.dispatchEvent(new Event("timeupdate")); });
    expect(screen.getByText("0:07 / 0:10")).toBeInTheDocument();
  });

  it("hands its audio element to a parent that plays it from elsewhere (the toolbar's Play my take)", () => {
    const ref = createRef<HTMLAudioElement>();
    render(<TakePlayer src="/take.wav" label="Play my take" audioRef={ref} />);
    expect(ref.current).toBeInstanceOf(HTMLAudioElement);
  });
});
