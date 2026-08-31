import * as SecureStore from 'expo-secure-store';

export interface MobileAppSettings {
  aiProvider: 'openai' | 'gemini' | 'anthropic' | 'groq' | 'openrouter' | 'local' | 'ondevice';
  onboardingCompleted: boolean;
  autoSanitize: boolean;
}

const SETTINGS_KEY = 'devqr_mobile_settings_v1';
const API_KEY_PREFIX = 'devqr_secure_key_';

export class MobileSecureStore {
  public static async getSettings(): Promise<MobileAppSettings> {
    try {
      const raw = await SecureStore.getItemAsync(SETTINGS_KEY);
      if (!raw) {
        return { aiProvider: 'openai', onboardingCompleted: false, autoSanitize: true };
      }
      return JSON.parse(raw);
    } catch {
      return { aiProvider: 'openai', onboardingCompleted: false, autoSanitize: true };
    }
  }

  public static async saveSettings(settings: Partial<MobileAppSettings>): Promise<MobileAppSettings> {
    const current = await this.getSettings();
    const updated = { ...current, ...settings };
    await SecureStore.setItemAsync(SETTINGS_KEY, JSON.stringify(updated));
    return updated;
  }

  public static async getApiKey(provider: string): Promise<string | null> {
    try {
      return await SecureStore.getItemAsync(`${API_KEY_PREFIX}${provider}`);
    } catch {
      return null;
    }
  }

  public static async saveApiKey(provider: string, key: string): Promise<void> {
    await SecureStore.setItemAsync(`${API_KEY_PREFIX}${provider}`, key);
  }

  public static async removeApiKey(provider: string): Promise<void> {
    await SecureStore.deleteItemAsync(`${API_KEY_PREFIX}${provider}`);
  }
}
