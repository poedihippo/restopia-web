import { ChevronsUpDown, ChevronRight, LogOut } from "lucide-react";
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

const data = {
  navMain: [
    {
      title: "User Master",
      url: "#",
      items: [
        {
          title: "Users",
          url: "/users",
        },
        {
          title: "Companies",
          url: "/users/companies",
        },
        {
          title: "Branches",
          url: "/users/branches",
        },
        {
          title: "Roles",
          url: "/users/roles",
        },
      ],
    },
    {
      title: "Media",
      url: "#",
    },
    {
      title: "Product Master",
      url: "#",
      items: [
        {
          title: "Product",
          url: "/products",
        },
        {
          title: "Product Category",
          url: "/products/product-categories",
        },
        {
          title: "UOM",
          url: "/products/uom",
        },
        {
          title: "Product Conversion",
          url: "/products/product-conversions",
        },
        {
          title: "Product UOM",
          url: "/products/product-uoms",
        },
        {
          title: "Product Inventory",
          url: "/products/product-inventory",
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
        },
        {
          title: "Production",
          url: "/production",
        },
      ],
    },
    {
      title: "Purchase Master",
      url: "#",
      items: [
        {
          title: "Supplier",
          url: "#",
        },
        {
          title: "Purchase Order",
          url: "#",
        },
      ],
    },
    {
      title: "Transfer Master",
      url: "#",
      items: [
        {
          title: "Delivery",
          url: "#",
        },
        {
          title: "Receipt",
          url: "#",
        },
      ],
    },
    {
      title: "Sales Master",
      url: "#",
      items: [
        {
          title: "Customer",
          url: "#",
        },
        {
          title: "Voucher",
          url: "#",
        },
        {
          title: "Sales Order",
          url: "#",
        },
      ],
    },
  ],
};

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { logout, user } = useAuth();
  const router = useRouter();
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
                  {item.title}{" "}
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
                            asChild
                            isActive={
                              router.pathname === item.url ||
                              router.pathname.startsWith(item.url + "/")
                            }
                          >
                            <a href={item.url}>{item.title}</a>
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
    </Sidebar>
  );
}
