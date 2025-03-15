import { useDroppable } from '@dnd-kit/core'
import { useBreakpoint } from 'core/client/components/MediaQuery'
import { Player } from 'models/player'
import { Animation } from 'pages'
import { memo, useCallback, useEffect, useMemo, useState } from 'react'
import { Client } from 'react-hydration-provider'
import { getCardSize, highlightColorBright, playedCardSizeRatio } from 'utils/consts'
import styles from './CardArea.module.css'
import { PlayingCard } from './PlayingCard'

type Props = {
	id?: string
	playerData: {
		player?: Player
		numPlayers: number
		position: number
	}
	animationData: {
		animation?: Animation
		animateToPosition?: number
	}
}

const seatOffset = 25
const seatOffsetMobile = 18
const cardVerticalOffset = -3
const cardVerticalOffsetMobile = -6

const getRandomRotation = () => Math.random() * 10 * (Math.random() < 0.5 ? -1 : 1)

let queuedAnimation: NodeJS.Timeout | undefined

const BaseCardArea = ({ animationData, playerData, id }: Props) => {
	const { position, player, numPlayers } = playerData
	const { animation, animateToPosition} = animationData

	const { setNodeRef } = useDroppable({
		id: id || position,
	})

	const [randomRotation, setRandomRotation] = useState(0)
	useEffect(() => {
		if (!player?.playedCard && player?.isLocal) setRandomRotation(0)

		if (player?.playedCard && !queuedAnimation)
			queuedAnimation = setTimeout(
				() => {
					setRandomRotation(getRandomRotation())

					queuedAnimation = undefined
				},
				player?.isLocal ? 250 : 0
			)
	}, [player?.playedCard, setRandomRotation, player?.isLocal])

	const gotCards = animation === 'get-cards' && animateToPosition === position

	const getOffset = useCallback(
		(
			desktop: boolean,
			pos: number,
			extraY?: number,
			extraX?: number,
			verticalOnly?: boolean
		) => {
			const off = desktop ? seatOffset : seatOffsetMobile
			const layouts = [
				[ ],
				[ [0, off] ],
				[ [0, off], [0, -off] ],
				[ [0, off], [-off, -off*0.6], [off, -off*0.6] ],
				[ [0, off], [-off, 0], [0, -off], [off, 0] ],
				[ [0, off], [-off, off*0.4], [-off*0.6, -off], [off*0.6, -off], [off, off*0.4] ]
			]

			const cardSize = playedCardSizeRatio * getCardSize(desktop)
			const [x, y] = layouts[numPlayers][pos]
			return {
				top: `calc(50% - ${cardSize}dvh + ${
					y
				}dvh + ${extraY || 0}dvh + ${
					desktop ? cardVerticalOffset : cardVerticalOffsetMobile
				}dvh)`,
				...(!verticalOnly && {
					left: `calc(50% - ${cardSize / 2}dvh + ${
						x
					}dvh + ${extraX || 0}dvh)`,
				}),
			}
		},
		[numPlayers]
	)

	const getStyles = useCallback(
		(desktop: boolean) => {
			const baseStyle: React.CSSProperties = {
				position: 'fixed',
				transition:
					'opacity 250ms ease, transform 500ms ease, top 250ms ease, left 250ms ease',
				...getOffset(desktop, position),
			}

			const staticStyle: React.CSSProperties = {
				...baseStyle,
				...(animation && !gotCards && { opacity: 0 }),
			}

			const animatedStyle = {
				...baseStyle,
				transform: `rotateZ(${randomRotation}deg)`,
				opacity: player?.playedCard ? 1 : 0,
				...getOffset(desktop, position, 1, 0, true),
				...(!player?.isLocal &&
					!player?.playedCard && {
						transform: `translate(${
							position === 1 ? -10 : position === 3 ? 10 : 0
						}dvh, calc(${
							position === 2 ? -10 : position === 0 ? 10 : 0
						}dvh) rotateY(45deg) rotateZ(90deg)`,
					}),
				...(animation === 'get-cards' &&
					animateToPosition !== undefined && {
						...getOffset(
							desktop,
							animateToPosition,
							-1 * (position === 2 ? 2.5 : position === 0 ? -2.5 : 0) + 4,
							-1 * (position === 1 ? 5.0 : position === 3 ? -5.0 : 0)
						),
					}),
			}

			return [staticStyle, animatedStyle]
		},
		[position, animation, animateToPosition, player, gotCards, randomRotation, getOffset]
	)

	const desktop = useBreakpoint('desktop')

	const [staticStyle, animatedStyle] = useMemo(() => getStyles(desktop), [getStyles, desktop])

	const nameStyle = useMemo(
		() => ({
			transition: 'opacity 100ms ease, color 100ms ease',
			maxWidth: '15dvh',
			color: 'white',
			opacity: 0.85,
			...((player?.isPlaying || gotCards) && {
				color: `rgba(${highlightColorBright}, 1)`,
			}),
		}),
		[player?.isPlaying, gotCards]
	)

	return (
		<Client>
			<div>
				<div style={staticStyle}>
					<div className={styles.NameContainer}>
						<p className='text-md truncate font-medium' style={nameStyle}>
							{player?.name} : {player?.score} Total: {player?.points}
						</p>
					</div>
					<div ref={setNodeRef}>
						<PlayingCard isPlaying={player?.isPlaying} isPlayed />
					</div>
				</div>
				<div style={animatedStyle}>
					{player?.playedCard && <PlayingCard id={player?.playedCard} isPlayed />}
				</div>
			</div>
		</Client>
	)
}

export const CardArea = memo(BaseCardArea)
