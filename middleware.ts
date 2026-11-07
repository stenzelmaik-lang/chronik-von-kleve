import {NextResponse,type NextRequest} from 'next/server';

/** Old public bookmarks lead to the branded address without exposing the account hostname. */
export function middleware(request:NextRequest){
  const url=new URL(request.url);
  const legacy='chronik-von-kleve.stenzel-maik.workers.dev';
  const oldHost=url.hostname===legacy;
  if(oldHost&&['GET','HEAD'].includes(request.method)&&!url.pathname.startsWith('/api/')&&!url.pathname.startsWith('/_next/')){
    url.protocol='https:';
    url.host='chroniplay.cc';
    return NextResponse.redirect(url,307);
  }
  return NextResponse.next();
}
export const config={matcher:['/:path*']};
