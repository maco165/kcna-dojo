/** サイト名の横の印。ファビコン (public/favicon.svg) と同じ絵を使う */
export default function SiteLogo({ size = 24 }: { size?: number }) {
  return <img src={`${import.meta.env.BASE_URL}favicon.svg`} width={size} height={size} alt="" aria-hidden="true" className="site-logo" />;
}
