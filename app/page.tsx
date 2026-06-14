import Image from "next/image";
import Link from "next/link";

export default function Home() {
  return (
    <main className="relative min-h-[100svh] min-w-0 overflow-hidden bg-[#39bbb1] bg-[url('/images/homepage-background-mobile.webp')] bg-[length:100%_auto] bg-bottom bg-no-repeat px-6 pb-[58vh] pt-7 sm:px-10 lg:bg-[url('/images/homepage-background.webp')] lg:bg-cover lg:bg-center lg:px-[3.65vw] lg:pb-32 lg:pt-[6.8vh]">
      <section className="relative z-10 w-[320px] min-w-0 max-w-full sm:w-[560px] lg:w-full lg:max-w-[860px]">
        <Link href="/" className="inline-block" aria-label="LegacyLink home">
          <Image
            src="/images/ll-logo-light.svg"
            alt="LegacyLink"
            width={451}
            height={80}
            className="h-auto w-[190px] max-w-full sm:w-[280px] lg:w-[390px]"
            priority
          />
        </Link>

        <h1 className="mt-5 max-w-[860px] break-words text-[1.25rem] font-bold leading-[1.08] tracking-tight text-[#f5f2e8] sm:mt-9 sm:text-[2rem] lg:mt-12 lg:text-[2.5rem]">
          A family connection platform for stories, memories, and the people
          who made you.
        </h1>

        <p className="mt-3 max-w-[820px] text-[0.8rem] font-normal leading-5 text-[#f5f2e8] sm:mt-5 sm:text-lg sm:leading-7 lg:mt-6 lg:text-xl lg:leading-8">
          LegacyLink helps families preserve memories, share stories, explore
          their family history, and stay connected across generations.
        </p>

        <div className="mt-3 flex flex-nowrap gap-3 sm:mt-6 sm:gap-4 lg:mt-8">
          <Link
            href="/signup"
            className="button-primary whitespace-nowrap px-3 text-[0.68rem] sm:px-5 sm:text-sm"
          >
            Create an account
          </Link>

          <Link
            href="/login"
            className="button-secondary whitespace-nowrap px-3 text-[0.68rem] sm:px-5 sm:text-sm"
          >
            Log in
          </Link>
        </div>
      </section>
    </main>
  );
}
