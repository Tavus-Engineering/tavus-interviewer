/**
 * DeviceSelectorBar.tsx
 *
 * Per-device "pill" selectors for the lobby (Camera / Microphone / Speaker).
 * Each pill shows the label on the left and the selected device on the
 * right with a chevron — clicking the pill opens the native <select>
 * dropdown so users can switch devices without leaving the design.
 *
 * Consumed by: LobbyScreen
 */

import { useEffect, useState, useCallback } from "react";
import { PixelIcon, DEVICE_ICON } from "./pixelIcons";

interface DeviceSelectorBarProps {
  videoDeviceId: string | null;
  audioDeviceId: string | null;
  speakerDeviceId: string | null;
  onCameraChange: (deviceId: string) => void;
  onMicChange: (deviceId: string) => void;
  onSpeakerChange: (deviceId: string) => void;
}

interface DeviceInfo {
  deviceId: string;
  label: string;
}

export function DeviceSelectorBar({
  videoDeviceId,
  audioDeviceId,
  speakerDeviceId,
  onCameraChange,
  onMicChange,
  onSpeakerChange,
}: DeviceSelectorBarProps) {
  const [cameras, setCameras] = useState<DeviceInfo[]>([]);
  const [mics, setMics] = useState<DeviceInfo[]>([]);
  const [speakers, setSpeakers] = useState<DeviceInfo[]>([]);

  const enumerate = useCallback(async () => {
    try {
      // Request permission so labels populate.
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      stream.getTracks().forEach((t) => t.stop());

      const devices = await navigator.mediaDevices.enumerateDevices();
      const cams = devices
        .filter((d) => d.kind === "videoinput")
        .map((d) => ({ deviceId: d.deviceId, label: d.label || "Camera" }));
      const mks = devices
        .filter((d) => d.kind === "audioinput")
        .map((d) => ({ deviceId: d.deviceId, label: d.label || "Microphone" }));
      const sps = devices
        .filter((d) => d.kind === "audiooutput")
        .map((d) => ({ deviceId: d.deviceId, label: d.label || "Speaker" }));

      setCameras(cams);
      setMics(mks);
      setSpeakers(sps);

      // Seed defaults if not already chosen.
      if (!videoDeviceId && cams[0]) onCameraChange(cams[0].deviceId);
      if (!audioDeviceId && mks[0]) onMicChange(mks[0].deviceId);
      if (!speakerDeviceId && sps[0]) onSpeakerChange(sps[0].deviceId);
    } catch (err) {
      console.error("[DeviceSelectorBar] Failed to enumerate devices:", err);
    }
  }, [videoDeviceId, audioDeviceId, speakerDeviceId, onCameraChange, onMicChange, onSpeakerChange]);

  useEffect(() => {
    enumerate();
    const handleChange = () => enumerate();
    navigator.mediaDevices?.addEventListener?.("devicechange", handleChange);
    return () => {
      navigator.mediaDevices?.removeEventListener?.("devicechange", handleChange);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="lobby-pill-list">
      <DevicePill
        label="Camera"
        selectedId={videoDeviceId}
        devices={cameras}
        emptyText="No camera detected"
        onChange={onCameraChange}
      />
      <DevicePill
        label="Microphone"
        selectedId={audioDeviceId}
        devices={mics}
        emptyText="No microphone detected"
        onChange={onMicChange}
      />
      <DevicePill
        label="Speaker"
        selectedId={speakerDeviceId}
        devices={speakers}
        emptyText="System default"
        onChange={onSpeakerChange}
      />
    </div>
  );
}

interface DevicePillProps {
  label: string;
  selectedId: string | null;
  devices: DeviceInfo[];
  emptyText: string;
  onChange: (deviceId: string) => void;
}

function DevicePill({ label, selectedId, devices, emptyText, onChange }: DevicePillProps) {
  const selected = devices.find((d) => d.deviceId === selectedId);
  const displayLabel = selected?.label ?? (devices.length === 0 ? emptyText : "Default");

  return (
    <label className="lobby-pill">
      <PixelIcon name={DEVICE_ICON[label] ?? "camera"} className="lobby-pill__icon" />
      <span className="lobby-pill__label">{label}</span>
      <span className="lobby-pill__value" title={displayLabel}>
        <span className="lobby-pill__device-name">{displayLabel}</span>
      </span>
      <PixelIcon name="chevron" className="lobby-pill__chevron" />
      <select
        className="lobby-pill__native"
        value={selectedId ?? ""}
        onChange={(e) => onChange(e.target.value)}
      >
        {devices.length === 0 && <option value="">{emptyText}</option>}
        {devices.map((d) => (
          <option key={d.deviceId} value={d.deviceId}>
            {d.label}
          </option>
        ))}
      </select>
    </label>
  );
}
