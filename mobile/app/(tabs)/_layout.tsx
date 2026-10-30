import { Tabs } from 'expo-router';
import React, { useEffect } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';

import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useBrandColors } from '@/constants/brand';
import { useSession } from '@/hooks/use-session';
import { useLockedFeature } from '@/providers/LockedFeatureProvider';

function AnimatedTabIcon({ name, color, focused }: { name: string; color: string; focused: boolean }) {
  const scale = useSharedValue(focused ? 1.18 : 1);

  useEffect(() => {
    scale.value = withSpring(focused ? 1.18 : 1, {
      damping: 14,
      stiffness: 280,
      mass: 0.6,
    });
  }, [focused]);

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={style}>
      <IconSymbol size={26} name={name as any} color={color} />
    </Animated.View>
  );
}

export default function TabLayout() {
  const { user } = useSession();
  const { openLockedFeature } = useLockedFeature();
  const colors = useBrandColors();
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primaryFrom,
        tabBarInactiveTintColor: colors.subtext,
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          height: 64 + insets.bottom / 2,
          paddingBottom: Math.max(10, insets.bottom / 2),
          paddingTop: 6,
          shadowColor: '#000',
          shadowOpacity: 0.1,
          shadowRadius: 16,
          shadowOffset: { width: 0, height: -4 },
          elevation: 16,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          letterSpacing: 0.2,
        },
      }}>
      <Tabs.Screen
        name="feed"
        options={{
          title: 'Feed',
          tabBarIcon: ({ color, focused }) => <AnimatedTabIcon name="house.fill" color={color} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="reels"
        options={{
          title: 'Reels',
          tabBarIcon: ({ color, focused }) => (
            <AnimatedTabIcon name="play.rectangle.fill" color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="communities"
        options={{
          title: 'Communities',
          tabBarIcon: ({ color, focused }) => <AnimatedTabIcon name="person.2.fill" color={color} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          href: null,
          title: 'Messages',
          tabBarIcon: ({ color, focused }) => <AnimatedTabIcon name="message.fill" color={color} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, focused }) => <AnimatedTabIcon name="person.fill" color={color} focused={focused} />,
          tabBarButton: (props) => (
            <HapticTab
              {...props}
              onPress={(event) => {
                if (!user) {
                  event.preventDefault();
                  openLockedFeature('Your profile');
                  return;
                }
                props.onPress?.(event);
              }}
            />
          ),
        }}
      />
    </Tabs>
  );
}
