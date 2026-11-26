import {
  Activity,
  Boxes,
  CreditCard,
  LayoutDashboard,
  Package,
  Settings,
  ShoppingCart,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";

export const navigation = [
  {
    label: "OVERVIEW",
    items: [
      { name: "Dashboard", icon: LayoutDashboard, active: true },
      { name: "Analytics", icon: Activity },
    ],
  },
  {
    label: "COMMERCE",
    items: [
      { name: "Orders", icon: ShoppingCart },
      { name: "Products", icon: Package },
      { name: "Inventory", icon: Boxes },
      { name: "Customers", icon: Users },
    ],
  },
  {
    label: "MANAGEMENT",
    items: [
      { name: "Payments", icon: CreditCard },
      { name: "Reports", icon: Wallet },
      { name: "Settings", icon: Settings },
    ],
  },
] satisfies {
  label: string;
  items: {
    name: string;
    icon: LucideIcon;
    active?: boolean;
  }[];
}[];

export const metrics = [
  {
    title: "Total Revenue",
    value: "$48,294.00",
    change: "+12.8%",
    description: "vs. previous month",
    icon: Wallet,
    positive: true,
    color: "bg-[#F1ECFA] text-[#7955C8]",
  },
  {
    title: "Total Orders",
    value: "1,284",
    change: "+8.2%",
    description: "vs. previous month",
    icon: ShoppingCart,
    positive: true,
    color: "bg-violet-50 text-violet-600",
  },
  {
    title: "Total Customers",
    value: "8,549",
    change: "+5.4%",
    description: "vs. previous month",
    icon: Users,
    positive: true,
    color: "bg-emerald-50 text-emerald-600",
  },
  {
    title: "Average Order Value",
    value: "$37.61",
    change: "-2.1%",
    description: "vs. previous month",
    icon: CreditCard,
    positive: false,
    color: "bg-amber-50 text-amber-600",
  },
] satisfies {
  title: string;
  value: string;
  change: string;
  description: string;
  icon: LucideIcon;
  positive: boolean;
  color: string;
}[];

export const revenue = [
  { month: "Jan", current: 38, previous: 27 },
  { month: "Feb", current: 52, previous: 34 },
  { month: "Mar", current: 43, previous: 38 },
  { month: "Apr", current: 68, previous: 43 },
  { month: "May", current: 57, previous: 39 },
  { month: "Jun", current: 79, previous: 51 },
  { month: "Jul", current: 64, previous: 45 },
  { month: "Aug", current: 88, previous: 58 },
  { month: "Sep", current: 72, previous: 53 },
  { month: "Oct", current: 96, previous: 65 },
  { month: "Nov", current: 82, previous: 59 },
  { month: "Dec", current: 100, previous: 71 },
];

export const channels = [
  {
    name: "Online Store",
    percentage: 58,
    amount: "$28,010",
    color: "bg-[#7955C8]",
  },
  {
    name: "Marketplace",
    percentage: 27,
    amount: "$13,039",
    color: "bg-violet-500",
  },
  {
    name: "Retail Store",
    percentage: 15,
    amount: "$7,245",
    color: "bg-emerald-500",
  },
];

export const orders = [
  {
    id: "#ORD-7291",
    customer: "Olivia Rhye",
    initials: "OR",
    email: "olivia@example.com",
    date: "Nov 21, 2026",
    amount: "$249.00",
    status: "Completed",
    statusStyle: "bg-emerald-50 text-emerald-700",
  },
  {
    id: "#ORD-7290",
    customer: "Phoenix Baker",
    initials: "PB",
    email: "phoenix@example.com",
    date: "Nov 21, 2026",
    amount: "$125.50",
    status: "Processing",
    statusStyle: "bg-[#F1ECFA] text-[#7955C8]",
  },
  {
    id: "#ORD-7289",
    customer: "Lana Steiner",
    initials: "LS",
    email: "lana@example.com",
    date: "Nov 20, 2026",
    amount: "$89.00",
    status: "Completed",
    statusStyle: "bg-emerald-50 text-emerald-700",
  },
  {
    id: "#ORD-7288",
    customer: "Demi Wilkinson",
    initials: "DW",
    email: "demi@example.com",
    date: "Nov 20, 2026",
    amount: "$420.00",
    status: "Pending",
    statusStyle: "bg-amber-50 text-amber-700",
  },
  {
    id: "#ORD-7287",
    customer: "Candice Wu",
    initials: "CW",
    email: "candice@example.com",
    date: "Nov 19, 2026",
    amount: "$175.00",
    status: "Completed",
    statusStyle: "bg-emerald-50 text-emerald-700",
  },
];
