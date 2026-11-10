import Purchases, {
  type PurchasesOfferings,
  type PurchasesPackage,
  type CustomerInfo,
} from 'react-native-purchases';

export interface IRevenueCatService {
  initialize(apiKey: string, appUserId?: string): Promise<void>;
  getOfferings(): Promise<PurchasesOfferings | null>;
  purchasePackage(pkg: PurchasesPackage): Promise<{ success: boolean; customerInfo: CustomerInfo }>;
  restorePurchases(): Promise<{ success: boolean; customerInfo: CustomerInfo }>;
  getCustomerInfo(): Promise<CustomerInfo | null>;
  logIn(appUserId: string): Promise<{ customerInfo: CustomerInfo; created: boolean }>;
  logOut(): Promise<CustomerInfo>;
}

export class RevenueCatService implements IRevenueCatService {
  private isConfigured = false;

  async initialize(apiKey: string, appUserId?: string): Promise<void> {
    if (this.isConfigured) return;
    try {
      Purchases.configure({
        apiKey,
        appUserID: appUserId || null,
      });
      this.isConfigured = true;
    } catch (error) {
      // Graceful fallback for non-native environments or invalid keys during dev
      console.warn('[RevenueCatService] Failed to configure Purchases SDK:', error);
    }
  }

  async getOfferings(): Promise<PurchasesOfferings | null> {
    try {
      const offerings = await Purchases.getOfferings();
      return offerings;
    } catch (error) {
      console.warn('[RevenueCatService] Error fetching offerings:', error);
      return null;
    }
  }

  async purchasePackage(
    pkg: PurchasesPackage,
  ): Promise<{ success: boolean; customerInfo: CustomerInfo }> {
    try {
      const { customerInfo } = await Purchases.purchasePackage(pkg);
      return { success: true, customerInfo };
    } catch (error: any) {
      if (error?.userCancelled) {
        return { success: false, customerInfo: null as any };
      }
      throw error;
    }
  }

  async restorePurchases(): Promise<{ success: boolean; customerInfo: CustomerInfo }> {
    try {
      const customerInfo = await Purchases.restorePurchases();
      return { success: true, customerInfo };
    } catch (error) {
      console.warn('[RevenueCatService] Error restoring purchases:', error);
      throw error;
    }
  }

  async getCustomerInfo(): Promise<CustomerInfo | null> {
    try {
      return await Purchases.getCustomerInfo();
    } catch (error) {
      console.warn('[RevenueCatService] Error fetching customer info:', error);
      return null;
    }
  }

  async logIn(appUserId: string): Promise<{ customerInfo: CustomerInfo; created: boolean }> {
    try {
      return await Purchases.logIn(appUserId);
    } catch (error) {
      console.warn('[RevenueCatService] Error logging in:', error);
      throw error;
    }
  }

  async logOut(): Promise<CustomerInfo> {
    try {
      return await Purchases.logOut();
    } catch (error) {
      console.warn('[RevenueCatService] Error logging out:', error);
      throw error;
    }
  }
}

export const defaultRevenueCatService = new RevenueCatService();
