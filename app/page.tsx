import Image from "next/image";
import Link from "next/link";

export default function Home() {
  return (
    <main className="relative isolate min-h-[100svh] min-w-0 overflow-hidden bg-[#071a3a] text-white">
      <Image
        src="/images/homepage-sci-fi.webp"
        alt=""
        fill
        priority
        quality={90}
        sizes="100vw"
        className="z-0 object-cover object-[43%_center] sm:object-center"
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 z-[1] bg-gradient-to-b from-[#061735]/20 via-transparent to-[#061735]/35 sm:hidden"
      />

      <div className="relative z-10 min-h-[100svh] w-full px-5 pb-8 pt-6 sm:px-9 sm:pb-10 sm:pt-8 lg:px-[3.25vw] lg:pb-[5vh] lg:pt-[4.3vh]">
        <header className="flex flex-col items-start gap-5 sm:flex-row sm:items-start sm:justify-between sm:gap-8">
          <Link
            href="/"
            className="inline-block shrink-0"
            aria-label="LegacyLink home"
          >
            <Image
              src="/images/legacy-link-logo-white.svg"
              alt="LegacyLink — For Every Trailblazer"
              width={678}
              height={168}
              className="h-auto w-[190px] sm:w-[245px] lg:w-[315px]"
              priority
            />
          </Link>

          <nav
            aria-label="Account"
            className="flex w-full flex-wrap gap-2.5 sm:w-auto sm:flex-nowrap sm:gap-3"
          >
            <Link
              href="/signup"
              className="button-primary min-h-11 flex-1 whitespace-nowrap px-4 text-[0.65rem] shadow-[0_7px_18px_rgb(4_18_47/24%)] sm:flex-none sm:px-6 sm:text-xs lg:min-h-16 lg:px-8 lg:text-sm"
            >
              Create an account
            </Link>

            <Link
              href="/login"
              className="button-secondary min-h-11 flex-1 whitespace-nowrap px-4 text-[0.65rem] shadow-[0_7px_18px_rgb(4_18_47/20%)] sm:flex-none sm:px-6 sm:text-xs lg:min-h-16 lg:px-8 lg:text-sm"
            >
              Log in
            </Link>
          </nav>
        </header>

        <section className="mt-8 max-w-[900px] sm:mt-10 lg:mt-9">
          <h1 className="text-[clamp(2rem,4vw,4.25rem)] font-bold leading-[0.98] tracking-[-0.025em] text-[#f5f2e8] [text-shadow:0_3px_22px_rgb(3_13_34/55%)]">
            A family connection
            <span className="hidden lg:inline">
              <br />
            </span>{" "}
            platform for stories,
            <span className="hidden lg:inline">
              <br />
            </span>{" "}
            memories, and the people
            <span className="hidden lg:inline">
              <br />
            </span>{" "}
            who made you.
          </h1>
        </section>
      </div>
    </main>
  );
}
