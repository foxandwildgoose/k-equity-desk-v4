import { useState, type FormEvent } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { authClient, authEnabled, GROK_PROVIDERS, signIn } from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { UserButton } from "@/lib/auth/gates";
import { emailAndPasswordEnabled } from "@/lib/auth/email-password";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/login")({ component: Login });
function Login() {
  const { user, isPending } = useCurrentUserState();
  const [register, setRegister] = useState(false);
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setFailed(false);
    try {
      const email = String(form.get("email"));
      const password = String(form.get("password"));
      const result = register
        ? await authClient.signUp.email({ email, password, name: String(form.get("name")) })
        : await authClient.signIn.email({ email, password });
      if (result.error) setFailed(true);
      else window.location.assign("/status/kiwoom");
    } catch {
      setFailed(true);
    } finally {
      setPending(false);
    }
  }
  return (
    <div className="page-stack">
      <PageHeader
        kicker="Personal account"
        title="로그인"
        lead="키움 자료는 서버에서 확인한 소유자 계정으로만 조회할 수 있습니다."
      />
      <section className="mx-auto w-full max-w-md space-y-4 rounded-xl border border-border bg-card p-5">
        {!authEnabled ? (
          <p>로그인 비활성 · 서버에서 인증을 활성화한 뒤 다시 접속하세요.</p>
        ) : isPending ? (
          <p>세션 확인 중…</p>
        ) : user ? (
          <>
            <UserButton />
            <p className="break-all text-sm">
              내 계정 ID: <code>{user.id}</code>
            </p>
            <p className="text-sm text-muted-foreground">
              관리자가 이 계정 ID를 서버의 키움 소유자로 등록해야 자료 접근이 허용됩니다.
            </p>
            <Button asChild>
              <Link to="/status/kiwoom">키움 연결 상태</Link>
            </Button>
          </>
        ) : (
          <>
            {emailAndPasswordEnabled && (
              <form className="space-y-3" onSubmit={submit}>
                {register && (
                  <label className="block space-y-1 text-sm">
                    이름
                    <Input name="name" required maxLength={100} autoComplete="name" />
                  </label>
                )}
                <label className="block space-y-1 text-sm">
                  이메일
                  <Input name="email" type="email" required autoComplete="username" />
                </label>
                <label className="block space-y-1 text-sm">
                  비밀번호
                  <Input
                    name="password"
                    type="password"
                    required
                    minLength={8}
                    maxLength={128}
                    autoComplete={register ? "new-password" : "current-password"}
                  />
                </label>
                <Button type="submit" disabled={pending}>
                  {pending ? "처리 중…" : register ? "계정 만들기" : "로그인"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  disabled={pending}
                  onClick={() => {
                    setRegister(!register);
                    setFailed(false);
                  }}
                >
                  {register ? "기존 계정으로 로그인" : "새 계정 만들기"}
                </Button>
              </form>
            )}
            {GROK_PROVIDERS.map((provider) => (
              <Button
                className="w-full"
                variant="outline"
                key={provider.providerId}
                disabled={pending}
                onClick={async () => {
                  setPending(true);
                  setFailed(false);
                  try {
                    await signIn(provider.providerId, {
                      callbackURL: "/status/kiwoom",
                      errorCallbackURL: "/login",
                    });
                  } catch {
                    setFailed(true);
                  } finally {
                    setPending(false);
                  }
                }}
              >
                {provider.label}로 로그인
              </Button>
            ))}
            <p className="text-xs text-muted-foreground">
              계정 생성만으로 키움 자료 권한이 부여되지 않습니다.
            </p>
          </>
        )}
        {failed && (
          <p role="alert" className="text-sm text-destructive">
            로그인 처리 실패 · 입력 정보와 서버 인증 설정을 확인하세요.
          </p>
        )}
      </section>
    </div>
  );
}
