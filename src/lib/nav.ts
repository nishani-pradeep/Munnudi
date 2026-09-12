import {
  LayoutDashboard,
  IndianRupee,
  Gauge,
  ReceiptText,
  Landmark,
  ChartNoAxesCombined,
  Settings,
  History,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  description: string;
  /** Whether this page is scoped to the selected month. */
  monthScoped: boolean;
};

/** Information architecture per PRD section 5. */
export const NAV_ITEMS: readonly NavItem[] = [
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    description: "Portfolio health and trends",
    monthScoped: true,
  },
  {
    href: "/rent",
    label: "Rent",
    icon: IndianRupee,
    description: "Unit-by-unit expected and paid rent",
    monthScoped: true,
  },
  {
    href: "/utilities",
    label: "Utilities",
    icon: Gauge,
    description: "Electricity and water readings",
    monthScoped: true,
  },
  {
    href: "/expenses",
    label: "Expenses",
    icon: ReceiptText,
    description: "Property and common expenses",
    monthScoped: true,
  },
  {
    href: "/loans",
    label: "Loans",
    icon: Landmark,
    description: "Loan masters and repayments",
    monthScoped: true,
  },
  {
    href: "/reports",
    label: "Reports",
    icon: ChartNoAxesCombined,
    description: "Historical analysis and export",
    monthScoped: false,
  },
  {
    href: "/settings",
    label: "Settings",
    icon: Settings,
    description: "Property, units, rent and loan setup",
    monthScoped: false,
  },
  {
    href: "/history",
    label: "History",
    icon: History,
    description: "Corrections and activity log",
    monthScoped: false,
  },
] as const;
