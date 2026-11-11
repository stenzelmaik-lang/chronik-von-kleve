import { redirect } from "next/navigation";
import { currentUserFromContext } from "@/server/platform-auth";
import AccountProfile from "./account-ui";
import { engagementEnabled } from '@/server/engagement-config';
export default async function ProfilePage(){if(!await currentUserFromContext())redirect('/anmelden');return <AccountProfile engagementAvailable={engagementEnabled()}/>;}
