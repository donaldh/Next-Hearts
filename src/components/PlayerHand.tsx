import clsx from 'clsx'
import { useBreakpoint } from 'core/client/components/MediaQuery'
import { Card } from 'models/card'
import { isValidMove } from 'models/game'
import { Player } from 'models/player'
import { memo, useCallback, useMemo } from 'react'
import { Client } from 'react-hydration-provider'
import { getCardSize, handCardVisibleRatio, maxCardsHandRowMobile } from 'utils/consts'
import styles from './PlayerHand.module.css'
import { PlayingCard } from './PlayingCard'

const getCenteredHand = (amount: number, isMobile: boolean) => {
	const s = handCardVisibleRatio * getCardSize(!isMobile)
	return {
		'--hand-container-offset': `${(amount * s) / 2}dvh - ${s}dvh`,
	} as React.CSSProperties
}

type Props = {
	localPlayer?: Player
	interactive?: boolean
	startingCard?: Card
	isHeartsBroken?: boolean
	draggingCard?: Card
	swapPhase?: boolean
	selectedCards?: Card[]
}

const BasePlayerHand = ({
	localPlayer,
	interactive,
	startingCard,
	isHeartsBroken,
	draggingCard,
	swapPhase,
	selectedCards = [],
}: Props) => {
	const desktop = useBreakpoint('desktop')

	const renderHandCard = useCallback(
		(c: Card) => {
			return (
				localPlayer &&
				localPlayer.playedCard !== c && (
					<PlayingCard
						isInHand
						isPlaying={interactive}
						isDisabled={
							!swapPhase && 
							!isValidMove(c, localPlayer.hand, startingCard, isHeartsBroken) &&
							!localPlayer?.playedCard &&
							localPlayer.isPlaying
						}
						isDragging={c === draggingCard}
						isHovering={selectedCards.includes(c)}
						key={c}
						id={c}
					/>
				)
			)
		},
		[localPlayer, draggingCard, interactive, isHeartsBroken, startingCard, swapPhase, selectedCards]
	)

	const handOffsetDesktop = useMemo(
		() => getCenteredHand(localPlayer?.hand.length || 0, false),
		[localPlayer?.hand.length]
	)
	const handContainerTopOffsetMobile = useMemo(
		() => getCenteredHand(Math.min(maxCardsHandRowMobile, localPlayer?.hand.length || 0), true),
		[localPlayer?.hand.length]
	)
	const handContainerBottomOffsetMobile = useMemo(
		() => getCenteredHand((localPlayer?.hand.length || 0) - maxCardsHandRowMobile, true),
		[localPlayer?.hand.length]
	)

	return (
		<Client>
			{desktop ? (
				<div className={styles.HandContainer} style={handOffsetDesktop}>
					{localPlayer?.hand.map((card) => renderHandCard(card))}
				</div>
			) : (
				<>
					<div
						className={clsx(styles.HandContainer, styles.HandContainerTopRow)}
						style={handContainerTopOffsetMobile}
					>
						{localPlayer?.hand
							?.slice(0, maxCardsHandRowMobile)
							.map((card) => renderHandCard(card))}
					</div>
					<div
						className={clsx(styles.HandContainer, styles.HandContainerBottomRow)}
						style={handContainerBottomOffsetMobile}
					>
						{localPlayer?.hand
							?.slice(maxCardsHandRowMobile)
							.map((card) => renderHandCard(card))}
					</div>
				</>
			)}
		</Client>
	)
}

export const PlayerHand = memo(BasePlayerHand)
