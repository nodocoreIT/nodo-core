export type DocumentType = 'DNI' | 'CUIT' | 'CUIL' | 'Pasaporte';

export interface Buyer {
  fullName: string;
  documentType: DocumentType;
  documentNumber: string;
  address: string;
  city: string;
  state: string;
  phone: string;
  email: string;
  civilStatus?: string;
}

export interface TradeInVehicle {
  brand: string;
  model: string;
  version?: string;
  year: number;
  licensePlate: string;
  vin?: string;
  engineNumber?: string;
  agreedValue: number;
}

export type PaymentType = 'cash' | 'transfer' | 'check' | 'promissory_note';

export interface PaymentMethod {
  id: string;
  type: PaymentType;
  amount: number;
  currency: 'ARS' | 'USD';
  details?: string;
  dueDate?: string;
}

export interface SalesContractData {
  id?: string;
  date: string;
  vehicleId: string;

  // Seller
  sellerName?: string;
  sellerDocument?: string;

  // Buyer
  buyer: Buyer;

  // Trade-in (optional)
  tradeInVehicle?: TradeInVehicle;

  // Finances
  agreedSalePrice: number;
  currency: 'ARS' | 'USD';

  // Payments
  payments: PaymentMethod[];

  // Notes
  notes?: string;
}
