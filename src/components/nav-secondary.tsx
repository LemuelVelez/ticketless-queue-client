"use client"

import * as React from "react"
import { type Icon } from "@tabler/icons-react"

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

export function NavSecondary({
  items,
  activeItem,
  ...props
}: {
  items: {
    title: string
    url: string
    icon: Icon
  }[]
  activeItem?: string
} & React.ComponentPropsWithoutRef<typeof SidebarGroup>) {
  return (
    <SidebarGroup {...props}>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton
                asChild
                isActive={activeItem === item.title}
                className={`
                  ${activeItem === item.title
                    ? 'bg-purple-100 text-purple-900 border-l-4 border-purple-600 font-semibold dark:bg-purple-900 dark:text-purple-100 dark:border-purple-400'
                    : 'hover:bg-gray-100 dark:hover:bg-gray-800'
                  }
                  transition-all duration-200
                `}
              >
                <a href={item.url}>
                  <item.icon />
                  <span>{item.title}</span>
                </a>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
