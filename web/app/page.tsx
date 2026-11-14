import site from "./_data/site.json";
import Bento, { type Site } from "./bento";

export default function Home() {
  return <Bento site={site as unknown as Site} />;
}
