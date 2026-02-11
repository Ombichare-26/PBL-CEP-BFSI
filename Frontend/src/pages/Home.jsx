import Hero from "../components/Hero.Homepage";
import HowWeWork from "../components/HowWeWork.Homepage";
import Privacy from "../components/Privacy.Homepage";
import LinkHomepage from "../components/Link.Homepage";

export default function Home() {
  return (
    <>
    <LinkHomepage />
      <Hero />
      
      <HowWeWork />
      <Privacy />
    </>
  );
}
