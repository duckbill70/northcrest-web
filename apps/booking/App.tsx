import { useEffect, useState } from "react";
import { Layout } from "../../shared/ui";
import { Book } from "./Book";
import { Manage } from "./Manage";

function usePath() {
  const [path, setPath] = useState(location.pathname);
  useEffect(() => {
    const onPop = () => setPath(location.pathname);
    addEventListener("popstate", onPop);
    return () => removeEventListener("popstate", onPop);
  }, []);
  return path;
}

export function App() {
  const path = usePath();
  const manage = path.startsWith("/manage");
  const statusUrl = import.meta.env.VITE_STATUS_URL;
  const nav = [
    { href: "/", label: "Book", current: !manage },
    { href: "/manage", label: "Manage booking", current: manage },
    ...(statusUrl ? [{ href: statusUrl, label: "Flight status" }] : []),
  ];
  return (
    <Layout section="Bookings" nav={nav}>
      {manage ? <Manage key={location.search} /> : <Book />}
    </Layout>
  );
}
