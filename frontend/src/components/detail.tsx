import Image from "next/image"
export default function Detail() {
    return (
        <section className="">
            <div className="p-4">
                <Image
                    src="/laptop.jpg"
                    alt="logo"
                    width={700}
                    height={200}
                    className="object-contain cursor-pointer items-center"
                />

            </div>
        </section>
    )
}