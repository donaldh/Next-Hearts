import { useAutoAnimate } from '@formkit/auto-animate/react'
import { CheckCircleIcon, ClipboardDocumentCheckIcon } from '@heroicons/react/24/outline'
import { Button, Card, Divider, Modal, ModalContent } from '@heroui/react'
import { Player } from 'models/player'
import { useState } from 'react'
import { modalProps } from 'utils/consts'
import { ModalWrapper } from './ModalContent'

export const WaitingForPlayers = ({ players, roomID }: { players: Player[]; roomID?: string }) => {
	const [animationParent] = useAutoAnimate()
	const [copied, setCopied] = useState(false)
	return (
		<Modal
			{...modalProps}
			size='sm'
			isOpen={players.length > 0 && players.length < 4 && !!roomID}
		>
			<ModalContent>
				<ModalWrapper>
					<h1 className='text-2xl font-bold'>Waiting for players...</h1>

					<Divider />

					<ul className='w-full flex flex-col gap-4' ref={animationParent}>
						{players.map((p) => (
							<Card key={p.publicID} shadow='lg'>
								<div className='px-4 py-2 flex justify-between items-center'>
									<h6
										className={`m-w-[150px] truncate font-bold m-0 ${
											p.isLocal ? 'text-primary' : 'text-gray-500'
										}`}
									>
										{p.name}
									</h6>

									<CheckCircleIcon className='stroke-[2] w-5 text-primary' />
								</div>
							</Card>
						))}
					</ul>

					<Divider />

					<p className='text-gray-500 text-sm font-semibold'>{roomID}</p>

					<Button
						onClick={() => {
							navigator.clipboard.writeText(
								typeof window !== 'undefined' ? window.location.href : ''
							)
							setCopied(true)
						}}
						className={copied ? 'text-gray-500' : undefined}
						color={copied ? 'default' : 'primary'}
					>
						<div className='flex gap-2 items-center'>
							{copied ? 'Copied ' : 'Share link'}
							{copied && (
								<ClipboardDocumentCheckIcon className='stroke-[2] w-4 text-gray-500' />
							)}
						</div>
					</Button>
				</ModalWrapper>
			</ModalContent>
		</Modal>
	)
}
