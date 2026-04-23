import ChannelPage, { type ChannelPageSP } from "@/components/channel/ChannelPage";
export default async function Page({ searchParams }: { searchParams: Promise<ChannelPageSP> }) {
  return <ChannelPage channel="place" searchParams={await searchParams} />;
}
