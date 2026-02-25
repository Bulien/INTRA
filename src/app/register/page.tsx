import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { RegisterForm } from "./RegisterForm";

export default async function RegisterPage() {
  const session = await auth();
  if (session?.user) {
    redirect("/");
  }

  return (
    <div className="max-w-md mx-auto mt-16">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-cyan-300 to-pink-300 bg-clip-text text-transparent mb-2 flex items-center justify-center gap-2">
          <img src="/yinyang_gen2.png" alt="" aria-hidden className="h-8 w-8 block bg-transparent mix-blend-multiply" /> INTRA
        </h1>
        <p className="text-neutral-400">
          Create an account to register your results in the rankings
        </p>
      </div>

      <RegisterForm />
    </div>
  );
}
