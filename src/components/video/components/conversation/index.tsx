import React, { useEffect, useRef } from "react";
import {
	DailyAudioTrack,
	DailyVideo,
	useDevices,
	useLocalSessionId,
	useMeetingState,
	useScreenShare,
	useVideoTrack
} from "@daily-co/daily-react";
import { useLocalScreenshare } from "../../hooks/use-local-screenshare";
import { useReplicaIDs } from "../../hooks/use-replica-ids";
import { useCall } from "../../hooks/use-call";
import { AudioWave } from "../audio-wave";

import styles from "./conversation.module.css";

interface ConversationProps {
	onLeave: () => void;
	conversationUrl: string;
	videoDeviceId?: string | null;
	audioDeviceId?: string | null;
	speakerDeviceId?: string | null;
	/** When false, the replica's presentation slide is not shown (defaults to true). */
	showPresentation?: boolean;
}

const VideoPreview = React.memo(({ id }: { id: string }) => {
	const videoState = useVideoTrack(id);
	const widthVideo = videoState.track?.getSettings()?.width;
	const heightVideo = videoState.track?.getSettings()?.height;
	const isVertical = widthVideo && heightVideo ? widthVideo < heightVideo : false;

	return (
		<div
			className={`${styles.previewVideoContainer} ${isVertical ? styles.previewVideoContainerVertical : ''} ${videoState.isOff ? styles.previewVideoContainerHidden : ''}`}
		>
			<DailyVideo
				automirror
				sessionId={id}
				type="video"
				className={`${styles.previewVideo} ${isVertical ? styles.previewVideoVertical : ''} ${videoState.isOff ? styles.previewVideoHidden : ''}`}
			/>
			<div className={styles.audioWaveContainer}>
				<AudioWave id={id} />
			</div>
		</div>
	);
});

const PreviewVideos = React.memo(() => {
	const localId = useLocalSessionId();
	const { isScreenSharing } = useLocalScreenshare();
	const replicaIds = useReplicaIDs();
	const replicaId = replicaIds[0];

	return (
		<>
			{isScreenSharing && (
				<VideoPreview id={replicaId} />
			)}
			<VideoPreview id={localId} />
		</>
	);
});

const MainVideo = React.memo(({ showPresentation = true }: { showPresentation?: boolean }) => {
	const replicaIds = useReplicaIDs();
	// This is one-to-one call, so we can use the first replica id
	const replicaId = replicaIds[0];
	const videoState = useVideoTrack(replicaId);
	// Presentation skill: slides are published as a screenVideo track on the
	// replica participant. useScreenShare surfaces any active remote screen
	// share regardless of participant, so we render the deck whenever one is
	// live (state "playable" or "loading", per the Tavus presentation docs).
	// The skill leaves the screen-share track up after the moment is over, so
	// `showPresentation` lets the caller hide the slide once the interview has
	// advanced past the objective it belongs to.
	const { screens } = useScreenShare();
	const slideScreen = showPresentation
		? screens.find(
				(s) =>
					!s.local &&
					(s.screenVideo.state === "playable" || s.screenVideo.state === "loading")
		  )
		: undefined;

	if (!replicaId) {
		return (
			<div className={styles.waitingContainer}>
				<p>Connecting...</p>
			</div>
		);
	}

	// While a slide is being presented, the slide's screenVideo track becomes
	// the main surface and the replica's camera stays visible as a corner PiP so
	// the interviewer never disappears mid-read. Otherwise the replica's camera
	// is the main surface. Replica audio keeps playing in every case.
	return (
		<div
			className={`${styles.mainVideoContainer} ${slideScreen ? styles.mainVideoContainerScreenSharing : ''}`}
		>
			<DailyVideo
				automirror
				sessionId={slideScreen ? slideScreen.session_id : replicaId}
				type={slideScreen ? "screenVideo" : "video"}
				className={`${styles.mainVideo}
				${slideScreen ? styles.mainVideoScreenSharing : ''}
				${(!slideScreen && videoState.isOff) ? styles.mainVideoHidden : ''}`}
			/>
			{slideScreen && !videoState.isOff && (
				<DailyVideo
					automirror
					sessionId={replicaId}
					type="video"
					className={styles.replicaPip}
				/>
			)}
			<DailyAudioTrack sessionId={replicaId} />
		</div>
	);
});

export const Conversation = React.memo(({ onLeave, conversationUrl, videoDeviceId, audioDeviceId, speakerDeviceId, showPresentation = true }: ConversationProps) => {
	const { joinCall } = useCall();
	const meetingState = useMeetingState();
	const { hasMicError, setSpeaker } = useDevices()
	const hasJoined = useRef(false);

	useEffect(() => {
		if (meetingState === 'error') {
			onLeave();
		}
	}, [meetingState, onLeave]);

	useEffect(() => {
		if (hasJoined.current) return;
		const joined = joinCall({ url: conversationUrl, videoDeviceId, audioDeviceId });
		if (joined) hasJoined.current = true;
	}, [joinCall, conversationUrl, videoDeviceId, audioDeviceId]);

	// setSpeaker can only run once we're actually in the meeting; otherwise
	// Daily throws and the user ends up on the system default.
	useEffect(() => {
		if (!speakerDeviceId) return;
		if (meetingState !== 'joined-meeting') return;
		try {
			setSpeaker(speakerDeviceId);
		} catch (err) {
			console.warn('[Conversation] setSpeaker failed:', err);
		}
	}, [speakerDeviceId, meetingState, setSpeaker]);

	// Leave is owned by the live screen via the CallControlBar overlay — this
	// component only renders the video surfaces.
	void onLeave;

	return (
		<div className={styles.container}>
			<div className={styles.videoContainer}>
				{
					hasMicError && (
						<div className={styles.errorContainer}>
							<p>
								Camera or microphone access denied. Please check your settings and try again.
							</p>
						</div>
					)}

				{/* Main video */}
				<div className={styles.mainVideoContainer}>
					<MainVideo showPresentation={showPresentation} />
				</div>

				{/* Self view */}
				<div className={styles.selfViewContainer}>
					<PreviewVideos />
				</div>
			</div>
		</div>
	);
});
