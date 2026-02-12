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
import Head from "next/head";
import React from "react";

interface GlobalLayoutProps {
  name: string;
  breadcrumb: string[];
  children: React.ReactNode;
}

function toHref(label: string) {
  return "/" + label.toLowerCase().replace(/\s+/g, "-");
}

export function GlobalLayout({
  name,
  breadcrumb,
  children,
}: GlobalLayoutProps) {
  return (
    <>
      <Head>
        <title>{name}</title>
      </Head>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <header className="sticky top-0 flex h-16 shrink-0 items-center gap-2 border-b px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 h-4" />
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
                          <BreadcrumbLink href={toHref(item)}>
                            {item}
                          </BreadcrumbLink>
                        )}
                      </BreadcrumbItem>
                    </React.Fragment>
                  );
                })}
              </BreadcrumbList>
            </Breadcrumb>
          </header>
          <div className="flex flex-1 flex-col gap-4 p-4">{children}</div>
        </SidebarInset>
      </SidebarProvider>
    </>
  );
}
