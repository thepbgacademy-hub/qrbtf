import { Container } from "@/components/Containers";

export function Header() {
  return (
    <header className="sticky top-0 z-20 border-b bg-background/90 backdrop-blur">
      <Container>
        <div className="flex h-14 items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-md border bg-foreground text-xs font-bold text-background">
              QR
            </div>
            <div>
              <div className="text-sm font-semibold">PBG Art QR Studio</div>
              <div className="text-xs text-muted-foreground">
                Hidden-image QR generator
              </div>
            </div>
          </div>
          <div className="hidden text-xs text-muted-foreground sm:block">
            Local prototype
          </div>
        </div>
      </Container>
    </header>
  );
}

export function HeaderPadding() {
  return null;
}

export function HeroLogo() {
  return null;
}
