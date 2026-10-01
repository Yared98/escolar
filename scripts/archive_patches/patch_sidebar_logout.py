import os

with open('frontend/src/components/Sidebar.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Import LogOut
content = content.replace("ShieldCheck,", "ShieldCheck,\n  LogOut,")

# Add logout to useAuth
content = content.replace("const { user } = useAuth();", "const { user, logout } = useAuth();")

# Inject Logout button at the end of NavLinks
bad_navlinks = """      {filteredItems.map((item) => {
        const Icon = item.icon;
        const isActive = activeRoute === item.id;
        return (
          <button
            key={item.id}
            onClick={() => {
              onRouteChange(item.id);
              if (onClickCallback) onClickCallback();
            }}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${
              isActive
                ? 'bg-salvia-700 text-white dark:bg-salvia-500 shadow-sm'
                : 'text-slate-800 dark:text-salvia-200 hover:bg-salvia-100 dark:hover:bg-salvia-800/60'
            }`}
          >
            <div className="flex items-center space-x-2.5">
              <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-salvia-600 dark:text-salvia-400'}`} />
              <span>{item.label}</span>
            </div>
            {isActive && <ChevronRight className="w-4 h-4" />}
          </button>
        );
      })}
    </nav>
  );"""
  
good_navlinks = """      {filteredItems.map((item) => {
        const Icon = item.icon;
        const isActive = activeRoute === item.id;
        return (
          <button
            key={item.id}
            onClick={() => {
              onRouteChange(item.id);
              if (onClickCallback) onClickCallback();
            }}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${
              isActive
                ? 'bg-salvia-700 text-white dark:bg-salvia-500 shadow-sm'
                : 'text-slate-800 dark:text-salvia-200 hover:bg-salvia-100 dark:hover:bg-salvia-800/60'
            }`}
          >
            <div className="flex items-center space-x-2.5">
              <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-salvia-600 dark:text-salvia-400'}`} />
              <span>{item.label}</span>
            </div>
            {isActive && <ChevronRight className="w-4 h-4" />}
          </button>
        );
      })}

      <div className="pt-2 mt-2 border-t border-salvia-100 dark:border-salvia-800">
        <button
          onClick={logout}
          className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-all text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50"
        >
          <div className="flex items-center space-x-2.5">
            <LogOut className="w-4 h-4" />
            <span>Sair do Sistema</span>
          </div>
        </button>
      </div>
    </nav>
  );"""

content = content.replace(bad_navlinks, good_navlinks)

with open('frontend/src/components/Sidebar.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
