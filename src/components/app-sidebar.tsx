import {
  ChevronsUpDown,
  ChevronRight,
  LogOut,
  User,
  Building,
  GitBranch,
  ShieldCheck,
  Image,
  Package,
  Tag,
  Ruler,
  ArrowLeftRight,
  PackageCheck,
  Warehouse,
  UtensilsCrossed,
  Factory,
  Truck,
  ClipboardList,
  SendHorizontal,
  PackageOpen,
  Users,
  Ticket,
  ShoppingCart,
} from "lucide-react";
import * as React from "react";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "next/router";
import useUserBranchPatch from "@/hooks/user/useUserBranchPatch";
import BranchSwitcherDialog from "./branch-switcher-dialog";

const data = {
  navMain: [
    {
      title: "Dashboard",
      url: "/dashboard",
    },
    {
      title: "User Master",
      url: "#",
      items: [
        {
          title: "Users",
          url: "/users",
          icon: <User />
        },
        {
          title: "Companies",
          url: "/users/companies",
          icon: <Building />
        },
        {
          title: "Branches",
          url: "/users/branches",
          icon: <GitBranch />
        },
        {
          title: "Roles",
          url: "/users/roles",
          icon: <ShieldCheck />
        },
      ],
    },
    {
      title: "Media",
      url: "/media",
    },
    {
      title: "Product Master",
      url: "#",
      items: [
        {
          title: "Product",
          url: "/products",
          icon: <Package />,
        },
        {
          title: "Product Category",
          url: "/products/product-categories",
          icon: <Tag />,
        },
        {
          title: "UOM",
          url: "/products/uom",
          icon: <Ruler />,
        },
        {
          title: "Product Conversion",
          url: "/products/product-conversions",
          icon: <ArrowLeftRight />,
        },
        {
          title: "Product UOM",
          url: "/products/product-uoms",
          icon: <PackageCheck />,
        },
        {
          title: "Product Inventory",
          url: "/products/product-inventory",
          icon: <Warehouse />,
        },
      ],
    },
    {
      title: "Production Master",
      url: "#",
      items: [
        {
          title: "Recipes",
          url: "/production/recipes",
          icon: <UtensilsCrossed />,
        },
        {
          title: "Production",
          url: "/production",
          icon: <Factory />,
        },
      ],
    },
    {
      title: "Purchase Master",
      url: "#",
      items: [
        {
          title: "Suppliers",
          url: "/purchase/suppliers",
          icon: <Truck />,
        },
        {
          title: "Purchase Order",
          url: "/purchase/purchase-orders",
          icon: <ClipboardList />,
        },
      ],
    },
    {
      title: "Transfer Master",
      url: "#",
      items: [
        {
          title: "Deliveries",
          url: "/transfer/deliveries",
          icon: <SendHorizontal />,
        },
        {
          title: "Receipts",
          url: "/transfer/receipts",
          icon: <PackageOpen />,
        },
      ],
    },
    {
      title: "Sales Master",
      url: "#",
      items: [
        {
          title: "Customers",
          url: "/sales/customers",
          icon: <Users />,
        },
        {
          title: "Vouchers",
          url: "/sales/vouchers",
          icon: <Ticket />,
        },
        {
          title: "Sales Orders",
          url: "/sales/sales-orders",
          icon: <ShoppingCart />,
        },
      ],
    },
  ],
};

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { logout, refreshUser, user, } = useAuth();
  const router = useRouter();
  const [branchDialogOpen, setBranchDialogOpen] = React.useState(false)
  const { mutate: changeBranch, isPending } = useUserBranchPatch()
  const handleChangeBranch = (branchId: number) => {
    changeBranch({ branch_id: branchId }, {
      onSuccess: () => {
        setBranchDialogOpen(false)
        refreshUser()
      }
    })
  }
  return (
    <Sidebar {...props}>
      <SidebarHeader>
        <h1 className="text-2xl font-bold text-black text-center">
          Dapur Cokelat
        </h1>
      </SidebarHeader>
      <SidebarContent className="gap-0">
        {data.navMain.map((item) => (
          <Collapsible
            key={item.title}
            title={item.title}
            className="group/collapsible"
          >
            <SidebarGroup>
              <SidebarGroupLabel
                asChild
                className="group/label text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground text-sm"
              >
                <CollapsibleTrigger>

                  {item.url === '#' ? <p className="font-bold">{item.title}{" "}</p> :
                    <a className="font-bold" href={item.url}>
                      {item.title}{" "}
                    </a>
                  }
                  {(item?.items?.length ?? 0) > 0 && (
                    <ChevronRight className="ml-auto transition-transform group-data-[state=open]/collapsible:rotate-90" />
                  )}
                </CollapsibleTrigger>
              </SidebarGroupLabel>
              <CollapsibleContent>
                <SidebarGroupContent>
                  {(item.items?.length ?? 0) > 0 && (
                    <SidebarMenu>
                      {item.items?.map((item) => (
                        <SidebarMenuItem key={item.title}>
                          <SidebarMenuButton
                            className="ml-2"
                            asChild
                            isActive={
                              router.pathname === item.url ||
                              router.pathname.startsWith(item.url + "/")
                            }
                          >
                            <a href={item.url}>
                              {item.icon}
                              {item.title}
                            </a>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      ))}
                    </SidebarMenu>
                  )}
                </SidebarGroupContent>
              </CollapsibleContent>
            </SidebarGroup>
          </Collapsible>
        ))}
      </SidebarContent>
      <SidebarRail />
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton size="lg" className="w-full">
                  <div className="bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg text-xs font-semibold">
                    {user?.name?.charAt(0)?.toUpperCase() ?? "U"}
                  </div>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-semibold">
                      {user?.name ?? "-"}
                    </span>
                    <span className="truncate text-xs text-muted-foreground">
                      {user?.email}
                    </span>
                  </div>
                  <ChevronsUpDown className="ml-auto size-4" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                side="top"
                className="w-[--radix-popper-anchor-width]"
                align="start"
              >
                <DropdownMenuLabel className="text-xs text-muted-foreground">
                  {user?.email}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {(user?.branches?.length ?? 0) > 1 && (
                  <>
                    <DropdownMenuItem onClick={() => setBranchDialogOpen(true)}>
                      <GitBranch className="mr-2 size-4" />
                      Change Branch
                    </DropdownMenuItem>
                  </>
                )}
                <DropdownMenuItem
                  onClick={logout}
                  className="text-destructive focus:text-destructive"
                >
                  <LogOut className="mr-2 size-4" />
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <BranchSwitcherDialog
        open={branchDialogOpen}
        onOpenChange={setBranchDialogOpen}
        branches={user?.branches ?? []}
        currentBranchId={user?.branch_id}
        onSelect={handleChangeBranch}
        isLoading={isPending}
      />
    </Sidebar>
  );
}
