import { Logo } from "@/components/logo";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-dvh flex-col px-4 pt-[env(safe-area-inset-top)]">
      <header className="mx-auto flex h-16 w-full max-w-md items-center">
        <Logo />
      </header>
      <main className="mx-auto w-full max-w-md flex-1 pb-12 pt-4">{children}</main>
    </div>
  );
}
