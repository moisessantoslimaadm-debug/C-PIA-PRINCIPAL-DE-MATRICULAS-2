import React, { useState, useEffect, createContext, useContext } from 'react';

const RouterContext = createContext<{ path: string; navigate: (path: string) => void }>({
  path: window.location.hash.slice(1) || '/',
  navigate: () => {},
});

export function useLocation() {
  const { path } = useContext(RouterContext);
  const [pathname, search] = path.split('?');
  return { pathname, search: search ? `?${search}` : '' };
}

export function useNavigate() {
  const { navigate } = useContext(RouterContext);
  return navigate;
}

export function useSearchParams() {
  const { search } = useLocation();
  return [new URLSearchParams(search)];
}

export function Link({ to, children, className, onClick, ...props }: any) {
  const { navigate } = useContext(RouterContext);
  const handleClick = (e: React.MouseEvent) => {
    if (onClick) onClick(e);
    e.preventDefault();
    navigate(to);
  };
  return (
    <a href={`#${to}`} onClick={handleClick} className={className} {...props}>
      {children}
    </a>
  );
}

export function Routes({ children }: { children?: React.ReactNode }) {
  const { pathname } = useLocation();
  let match = null;
  
  React.Children.forEach(children, (child) => {
    if (match) return;
    if (React.isValidElement(child)) {
      const { path, element } = child.props as any;
      if (path === pathname) {
        match = element;
      }
    }
  });
  
  return <>{match}</>;
}

export function Route({ path, element }: { path: string; element: React.ReactNode }) {
  return null;
}

export function HashRouter({ children }: { children?: React.ReactNode }) {
  const [path, setPath] = useState(window.location.hash.slice(1) || '/');

  useEffect(() => {
    const handleHashChange = () => {
      setPath(window.location.hash.slice(1) || '/');
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const navigate = (newPath: string) => {
    window.location.hash = newPath;
  };

  return (
    <RouterContext.Provider value={{ path, navigate }}>
      {children}
    </RouterContext.Provider>
  );
}