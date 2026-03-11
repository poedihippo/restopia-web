import { AppSidebar } from "@/components/app-sidebar";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { useAuth } from "@/hooks/useAuth";
import Head from "next/head";
import React from "react";

interface GlobalLayoutProps {
  name: string;
  breadcrumb: string[];
  children: React.ReactNode;
}

function toHref(breadcrumb: string[], index: number) {
  return (
    "/" +
    breadcrumb
      .slice(0, index + 1)
      .map((label) => label.toLowerCase().replace(/\s+/g, "-"))
      .join("/")
  );
}

export function GlobalLayout({
  name,
  breadcrumb,
  children,
}: GlobalLayoutProps) {
  const { user } = useAuth();

  return (
    <>
      <Head>
        <title>{name}</title>
        <link rel="icon" type="image/webp" href="/logo.webp" />
      </Head>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <header className=" top-0 flex h-16 shrink-0 items-center gap-2 border-b px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 h-4" />
            <div className="flex flex-1 flex-row justify-between">
              <Breadcrumb>
                <BreadcrumbList>
                  {breadcrumb.map((item, index) => {
                    const isLast = index === breadcrumb.length - 1;
                    return (
                      <React.Fragment key={item}>
                        {index > 0 && (
                          <BreadcrumbSeparator className="hidden md:block" />
                        )}
                        <BreadcrumbItem
                          className={!isLast ? "hidden md:block" : undefined}
                        >
                          {isLast ? (
                            <BreadcrumbPage>{item}</BreadcrumbPage>
                          ) : (
                            <BreadcrumbLink href={toHref(breadcrumb, index)}>
                              {item}
                            </BreadcrumbLink>
                          )}
                        </BreadcrumbItem>
                      </React.Fragment>
                    );
                  })}
                </BreadcrumbList>
              </Breadcrumb>
              <p>{user?.branch?.name ?? '-'} - {user?.branch?.company?.name ?? '-'}</p>
            </div>
          </header>
          <div className="flex flex-1 flex-col gap-4 p-4">{children}</div>
        </SidebarInset>
      </SidebarProvider>
    </>
  );
}
