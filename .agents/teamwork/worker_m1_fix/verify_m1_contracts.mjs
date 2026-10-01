#!/usr/bin/env node
/**
 * Comprehensive Contract & Verification Suite for Milestone 1 Iteration 2
 * Author: worker_m1_fix
 * Target Files: frontend/src/components/Sidebar.tsx & frontend/src/app/page.tsx
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '../../..');

console.log('================================================================================');
console.log('WORKER_M1_FIX VERIFICATION SUITE: MILESTONE 1 (page.tsx & Sidebar.tsx)');
console.log('================================================================================\n');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition, testName, details = '') {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  [PASS] ${testName}`);
  } else {
    failedTests++;
    console.error(`  [FAIL] ${testName}`);
    if (details) console.error(`         Detail: ${details}`);
  }
}

// 1. Source code inspection
const sidebarPath = path.join(PROJECT_ROOT, 'frontend/src/components/Sidebar.tsx');
const pagePath = path.join(PROJECT_ROOT, 'frontend/src/app/page.tsx');
const sidebarCode = fs.readFileSync(sidebarPath, 'utf8');
const pageCode = fs.readFileSync(pagePath, 'utf8');

console.log('SECTION 1: Interface & Function Signature Checks');
assert(
  sidebarCode.includes('onRouteChange?: (route: NavRoute, targetTab?: string) => void;'),
  'SidebarProps includes optional onRouteChange with targetTab'
);
assert(
  sidebarCode.includes('export const isRouteAllowed =') &&
  sidebarCode.includes('export const isRouteAuthorized = isRouteAllowed;'),
  'Sidebar.tsx exports isRouteAllowed and isRouteAuthorized alias'
);
assert(
  sidebarCode.includes('export const findRouteByTab = ('),
  'Sidebar.tsx exports findRouteByTab'
);
assert(
  pageCode.includes("import { Sidebar, NavRoute, MENU_ITEMS, findRouteByTab, isRouteAllowed, isRouteAuthorized } from '@/components/Sidebar';"),
  'page.tsx imports isRouteAllowed and isRouteAuthorized from Sidebar'
);
assert(
  pageCode.includes('const isAuthorized = (route: NavRoute): boolean => isRouteAllowed(route, role);'),
  'page.tsx de-duplicates isAuthorized via isRouteAllowed'
);

console.log('\nSECTION 2: URL Navigation & Single router.push Delegation');
assert(
  !sidebarCode.includes("params.set('route', item.id);\n      if (hasSubItems && item.defaultTab)"),
  'Sidebar.handleParentClick does not independently duplicate URL push when onRouteChange exists'
);
assert(
  sidebarCode.includes('onRouteChange(item.id, hasSubItems ? item.defaultTab : undefined);'),
  'Sidebar.handleParentClick delegates to onRouteChange with route and defaultTab'
);
assert(
  sidebarCode.includes('onRouteChange(parentRoute, subItem.tabKey);'),
  'Sidebar.handleSubItemClick delegates to onRouteChange with parentRoute and tabKey'
);
assert(
  pageCode.includes('const handleRouteChange = (newRoute: NavRoute, targetTab?: string) => {'),
  'page.tsx handleRouteChange accepts targetTab'
);
assert(
  pageCode.includes("params.set('tab', targetTab);"),
  'page.tsx handleRouteChange preserves targetTab'
);

console.log('\nSECTION 3: Root URL Browser Back Fallback');
assert(
  pageCode.includes("const defaultRoute: NavRoute = role === 'responsavel' ? 'portal_aluno' : 'overview';") &&
  pageCode.includes('if (activeRoute !== defaultRoute) {\n      setActiveRoute(defaultRoute);\n    }'),
  'page.tsx useEffect restores defaultRoute when returning to root URL without query params'
);

console.log('\nSECTION 4: Next.js Suspense Prerendering Invariant');
assert(
  pageCode.includes('<Suspense fallback={<SectionSkeleton />}>'),
  'page.tsx wraps DashboardContent in Suspense'
);

const prerenderManifestPath = path.join(PROJECT_ROOT, 'frontend/.next/prerender-manifest.json');
assert(
  fs.existsSync(prerenderManifestPath),
  'Next.js prerender-manifest.json exists from successful production build'
);

console.log('\n================================================================================');
console.log(`Summary: ${passedTests}/${totalTests} Passed | ${failedTests} Failed`);
console.log('================================================================================\n');

process.exit(failedTests > 0 ? 1 : 0);
