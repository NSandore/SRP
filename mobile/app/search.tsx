import { useLocalSearchParams } from 'expo-router';
import PlaceholderScreen from '@/components/PlaceholderScreen';

export default function SearchScreen() {
  const { q } = useLocalSearchParams<{ q?: string }>();
  return (
    <PlaceholderScreen
      title="Search"
      description={`Results for \"${q || ''}\" (wire to search endpoint next).`}
    />
  );
}
