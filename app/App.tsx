import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { DarkTheme, DefaultTheme } from '@react-navigation/native';
import AppNavigation from './navigation/MainNavigation';

const App = () => {
  const colorScheme = useColorScheme();

  return (
    <NavigationContainer theme={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AppNavigation />
      <StatusBar style="auto" />
    </NavigationContainer>
  );
};

export default App;

