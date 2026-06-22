import { useCallback } from 'react';
import { useDaily } from '@daily-co/daily-react';

interface JoinCallOptions {
	url: string;
	videoDeviceId?: string | null;
	audioDeviceId?: string | null;
}

export const useCall = (): {
	joinCall: (props: JoinCallOptions) => boolean;
	leaveCall: () => void;
} => {
	const daily = useDaily();

	const joinCall = useCallback(
		({ url, videoDeviceId, audioDeviceId }: JoinCallOptions): boolean => {
			if (!daily) return false;

			const state = daily.meetingState();
			if (state === 'joined-meeting' || state === 'joining-meeting') return true;

			daily.join({
				url: url,
				...(videoDeviceId && { videoSource: videoDeviceId }),
				...(audioDeviceId && { audioSource: audioDeviceId }),
				inputSettings: {
					audio: {
						processor: {
							type: "noise-cancellation",
						},
					},
				},
			});
			return true;
		},
		[daily]
	);

	const leaveCall = useCallback(() => {
		daily?.leave();
	}, [daily]);

	return { joinCall, leaveCall };
};
