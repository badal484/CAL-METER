export interface MockPurchasesPackage {
  identifier: string;
  packageType: string;
  product: {
    identifier: string;
    description: string;
    title: string;
    price: number;
    priceString: string;
    currencyCode: string;
  };
  offeringIdentifier: string;
}

export interface MockCustomerInfo {
  entitlements: {
    active: Record<
      string,
      {
        identifier: string;
        isActive: boolean;
        willRenew: boolean;
        periodType: string;
        latestPurchaseDate: string;
        originalPurchaseDate: string;
        expirationDate: string | null;
        store: string;
        productIdentifier: string;
        isSandbox: boolean;
      }
    >;
    all: Record<string, any>;
  };
  activeSubscriptions: string[];
  allPurchasedProductIdentifiers: string[];
  latestExpirationDate: string | null;
  firstSeen: string;
  originalAppUserId: string;
  requestDate: string;
  allExpirationDates: Record<string, string | null>;
  allPurchaseDates: Record<string, string>;
  originalPurchaseDate: string | null;
  managementURL: string | null;
}

export const mockMonthlyPackage: MockPurchasesPackage = {
  identifier: '$rc_monthly',
  packageType: 'MONTHLY',
  product: {
    identifier: 'calmeter_premium_monthly',
    description: 'Cal Meter Premium Monthly Subscription',
    title: 'Premium Monthly',
    price: 9.99,
    priceString: '$9.99',
    currencyCode: 'USD',
  },
  offeringIdentifier: 'default',
};

export const mockAnnualPackage: MockPurchasesPackage = {
  identifier: '$rc_annual',
  packageType: 'ANNUAL',
  product: {
    identifier: 'calmeter_premium_annual',
    description: 'Cal Meter Premium Annual Subscription',
    title: 'Premium Annual',
    price: 79.99,
    priceString: '$79.99',
    currencyCode: 'USD',
  },
  offeringIdentifier: 'default',
};

export const mockCustomerInfoActive: MockCustomerInfo = {
  entitlements: {
    active: {
      premium_access: {
        identifier: 'premium_access',
        isActive: true,
        willRenew: true,
        periodType: 'NORMAL',
        latestPurchaseDate: new Date().toISOString(),
        originalPurchaseDate: new Date().toISOString(),
        expirationDate: new Date(Date.now() + 30 * 86400000).toISOString(),
        store: 'APP_STORE',
        productIdentifier: 'calmeter_premium_monthly',
        isSandbox: true,
      },
    },
    all: {},
  },
  activeSubscriptions: ['calmeter_premium_monthly'],
  allPurchasedProductIdentifiers: ['calmeter_premium_monthly'],
  latestExpirationDate: new Date(Date.now() + 30 * 86400000).toISOString(),
  firstSeen: new Date().toISOString(),
  originalAppUserId: 'test-user',
  requestDate: new Date().toISOString(),
  allExpirationDates: {},
  allPurchaseDates: {},
  originalPurchaseDate: new Date().toISOString(),
  managementURL: 'https://apps.apple.com/account/subscriptions',
};

export const mockCustomerInfoFree: MockCustomerInfo = {
  entitlements: {
    active: {},
    all: {},
  },
  activeSubscriptions: [],
  allPurchasedProductIdentifiers: [],
  latestExpirationDate: null,
  firstSeen: new Date().toISOString(),
  originalAppUserId: 'test-user',
  requestDate: new Date().toISOString(),
  allExpirationDates: {},
  allPurchaseDates: {},
  originalPurchaseDate: null,
  managementURL: null,
};

const Purchases = {
  configure: async () => {},
  getOfferings: async () => ({
    current: {
      identifier: 'default',
      serverDescription: 'Default offerings',
      monthly: mockMonthlyPackage,
      annual: mockAnnualPackage,
      availablePackages: [mockMonthlyPackage, mockAnnualPackage],
    },
    all: {
      default: {
        identifier: 'default',
        serverDescription: 'Default offerings',
        monthly: mockMonthlyPackage,
        annual: mockAnnualPackage,
        availablePackages: [mockMonthlyPackage, mockAnnualPackage],
      },
    },
  }),
  purchasePackage: async (_pkg: MockPurchasesPackage) => ({
    customerInfo: mockCustomerInfoActive,
    productIdentifier: _pkg.product.identifier,
  }),
  restorePurchases: async () => mockCustomerInfoActive,
  getCustomerInfo: async () => mockCustomerInfoFree,
  logIn: async (_appUserId: string) => ({
    customerInfo: mockCustomerInfoFree,
    created: false,
  }),
  logOut: async () => mockCustomerInfoFree,
  setLogLevel: () => {},
  addCustomerInfoUpdateListener: () => () => {},
};

export default Purchases;
