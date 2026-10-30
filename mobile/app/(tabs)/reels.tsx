import ReelsComingSoon from '@/components/reels/ReelsComingSoon';
import ReelsScreen from '@/components/reels/ReelsScreen';
import { REELS_ENABLED } from '@/constants/features';

export default function ReelsRoute() {
  return REELS_ENABLED ? <ReelsScreen /> : <ReelsComingSoon />;
}
