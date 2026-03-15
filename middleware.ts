import { NextRequest, NextResponse } from "next/server";

const USERNAME = "mcdonawa";
const PASSWORD = "1958@Dodge";

export function middleware(req: NextRequest) {
  const authHeader = req.headers.get("authorization");

  if (authHeader) {
    const encoded = authHeader.split(" ")[1];
    const decoded = atob(encoded);
    const [user, pass] = decoded.split(":");
    if (user === USERNAME && pass === PASSWORD) {
      return NextResponse.next();
    }
  }

  return new NextResponse("Unauthorized", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="Secure Area"',
    },
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
