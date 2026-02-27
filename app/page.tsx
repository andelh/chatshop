"use client";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-white font-sans dark:bg-black">
      <main className="flex min-h-screen w-full max-w-3xl flex-col gap-6 py-24 px-6 bg-white dark:bg-black items-center justify-center">
        <Image
          src="/home.svg"
          alt="Chatshop home illustration"
          width={264}
          height={264}
          priority
        />
        <h3 className="text-balance text-5xl font-semibold text-[#333] max-w-2xl text-center tracking-tighter">
          Your 24/7 DM sales rep, connected directly to Shopify.
        </h3>
        <p className="text-black/60 font-medium text-lg max-w-xl mx-auto text-center text-balance">
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
      </main>
    </div>
  );
}
