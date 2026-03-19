"use client";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-white font-sans dark:bg-black">
      <main className="flex min-h-screen w-full max-w-3xl flex-col items-center justify-center gap-3 bg-white px-3 py-24 lg:gap-5 lg:px-6 dark:bg-black">
        <Image
          src="/home.svg"
          alt="Clerkit home illustration"
          width={264}
          height={264}
          priority
        />
        <h3 className="md:text-balance text-3xl lg:text-4xl font-medium text-[#333] max-w-2xl text-center tracking-tighter">
          Your <span className="font-semibold text-blue-500">always-on</span> DM
          sales rep, connected directly to{" "}
          <span className="font-semibold text-emerald-500">Shopify</span>.
        </h3>
        <p className="tracking-tight text-black/60 font-medium text-lg max-w-xl mx-auto text-center text-balance">
          Give every shopper fast, accurate replies on products, stock, and
          order status.
        </p>
        <div className="flex flex-row items-center justify-center gap-2">
          <Button
            asChild
            className="bg-black h-12 gap-1 px-4 text-md/relaxed"
            size={"lg"}
          >
            <Link href="/studio">Get Started</Link>
          </Button>
          <Button
            className=" h-12 gap-1 px-4 text-md/relaxed"
            size={"lg"}
            variant={"outline"}
          >
            Watch a demo
          </Button>
        </div>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm font-medium text-black/55">
          <Link className="transition hover:text-black" href="/privacy">
            Privacy
          </Link>
          <Link className="transition hover:text-black" href="/terms">
            Terms
          </Link>
        </div>
      </main>
    </div>
  );
}
