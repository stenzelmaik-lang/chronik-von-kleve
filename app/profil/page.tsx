import { redirect } from "next/navigation";
import { currentUserFromContext } from "@/server/platform-auth";
import AccountProfile from "./account-ui";
export default async function ProfilePage(){if(!await currentUserFromContext())redirect('/anmelden');return <AccountProfile/>;}
