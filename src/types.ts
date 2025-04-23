
export interface Coupon {
  id: string;
  name: string;
  product_code: string;
  coupon_code: number;
  price: number;
  items: Item[];
  start_date: string;
  end_date: string;
}

export interface Item {
  name: string;
  count: number;
  addition_price: number;
  flavors: Flavor[];
}

export interface Flavor {
  name: string;
  addition_price: number;
}
