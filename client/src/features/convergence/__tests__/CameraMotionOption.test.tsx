import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { CameraMotionOption } from "../components/CameraMotionPicker/CameraMotionOption";
import type { CameraPath } from "../types";

const { renderCameraMotionFramesMock, createFrameAnimatorMock } = vi.hoisted(
  () => ({
    renderCameraMotionFramesMock: vi.fn(),
    createFrameAnimatorMock: vi.fn(),
  }),
);

vi.mock("@/features/convergence/utils/cameraMotionRenderer", () => ({
  buildProxyUrl: (url: string) => url,
  renderCameraMotionFrames: renderCameraMotionFramesMock,
  createFrameAnimator: createFrameAnimatorMock,
}));

const baseCameraPath: CameraPath = {
  id: "push_in",
  label: "Push In",
  category: "dolly",
  start: {
    position: { x: 0, y: 0, z: 0 },
    rotation: { pitch: 0, yaw: 0, roll: 0 },
  },
  end: {
    position: { x: 0, y: 0, z: 1 },
    rotation: { pitch: 0, yaw: 0, roll: 0 },
  },
  duration: 2,
};

describe("CameraMotionOption", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    renderCameraMotionFramesMock.mockResolvedValue(["frame-1", "frame-2"]);
    createFrameAnimatorMock.mockReturnValue({
      start: vi.fn(),
      stop: vi.fn(),
    });

    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    });
  });

  it("renders fallback descriptions without attempting preview generation", () => {
    render(
      <CameraMotionOption
        cameraPath={baseCameraPath}
        imageUrl="https://example.com/image.png"
        depthMapUrl={null}
        fallbackMode={true}
      />,
    );

    expect(screen.getByText("Push In")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Camera moves toward subject. Creates intimacy or tension.",
      ),
    ).toBeInTheDocument();
    expect(renderCameraMotionFramesMock).not.toHaveBeenCalled();
  });

  it("renders preview frames lazily on hover", async () => {
    render(
      <CameraMotionOption
        cameraPath={baseCameraPath}
        imageUrl="https://example.com/image.png"
        depthMapUrl="https://example.com/depth.png"
      />,
    );

    fireEvent.mouseEnter(screen.getByRole("option", { name: "Push In" }));

    await waitFor(() => {
      expect(renderCameraMotionFramesMock).toHaveBeenCalledWith(
        "https://example.com/image.png",
        "https://example.com/depth.png",
        baseCameraPath,
        expect.objectContaining({
          width: 320,
          height: 180,
          fps: 15,
        }),
      );
    });
  });
});
