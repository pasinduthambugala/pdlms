import React from 'react';
import { NavLink } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { buttonVariants } from '@/components/ui/button';

// Define the navigation structure
const menuSections = [
  {
    title: 'OVERVIEW',
    items: [
      { name: 'Dashboard', to: '/dashboard' },
    ],
  },
  {
    title: 'DOCUMENTS',
    items: [
      { name: 'Documents', to: '/documents' },
      { name: 'Carts', to: '/carts' },
    ],
  },
  {
    title: 'OPERATIONS',
    items: [
      { name: 'Retrieval Requests', to: '/retrieval-requests' },
      { name: 'Disposal', to: '/disposal' },
      { name: 'Approvals', to: '/approvals' },
    ],
  },
  {
    title: 'FINANCE',
    items: [
      { name: 'Cost Management', to: '/cost-management' },
    ],
  },
  {
    title: 'ADMINISTRATION',
    items: [
      { name: 'Users', to: '/admin/users' },
      { name: 'Departments', to: '/admin/departments' },
      { name: 'Settings', to: '/admin/settings' },
    ],
  },
];

export function Sidebar() {
  // Assume a hook that provides the current user's role
  const { role } = useAuth(); // role: 'super_admin' | 'employee' | ...

  // Super Admin sees everything; other roles see a subset (filter logic omitted for brevity)
  const filteredSections = menuSections.filter(section => {
    if (role === 'super_admin') return true;
    // Example minimal filtering – adjust per role requirements
    if (role === 'employee') {
      return ['OVERVIEW', 'DOCUMENTS', 'OPERATIONS'].includes(section.title);
    }
    if (role === 'department_head') {
      return ['OVERVIEW', 'DOCUMENTS', 'OPERATIONS', 'FINANCE'].includes(section.title);
    }
    if (role === 'office_services') {
      return ['OVERVIEW', 'DOCUMENTS', 'OPERATIONS', 'FINANCE', 'ADMINISTRATION'].includes(section.title);
    }
    return false;
  });

  return (
    <aside className="w-64 bg-[#f8fafc] border-r border-gray-200 p-4 flex flex-col">
      {filteredSections.map(section => (
        <div key={section.title} className="mb-6">
          <h3 className="text-sm font-semibold text-gray-500 uppercase mb-2">
            {section.title}
          </h3>
          <nav className="space-y-1">
            {section.items.map(item => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  cn(
                    buttonVariants({ variant: 'ghost' }),
                    'w-full justify-start text-left',
                    isActive && 'bg-primary/10 text-primary'
                  )
                }
              >
                {item.name}
              </NavLink>
            ))}
          </nav>
        </div>
      ))}
    </aside>
  );
}

// Helper hook placeholder – replace with your actual auth store implementation
function useAuth() {
  // This is a stub; the real implementation should read from Zustand or context.
  return { role: 'super_admin' };
}
