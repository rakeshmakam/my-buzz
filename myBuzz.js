/**
    My Buzz view
    @extends app/views/base
 */
define([
    'app/views/base',
    'app/helpers/vent',
    'app/helpers/config',
    'reqLib/text!app/mybuzz/tpls/myBuzz.html',
    'app/mybuzz/collections/activityFeeds',
    'app/mybuzz/models/remixPost',
    'app/mybuzz/views/facebookActivityFeed',
    'app/mybuzz/views/twitterActivityFeed',
    'app/mybuzz/views/instagramActivityFeed',
    'app/mybuzz/views/tumblrActivityFeed',
    'app/mybuzz/views/soundCloudActivityFeed',
    'app/mybuzz/views/vimeoActivityFeed',
    'app/mybuzz/views/youtubeActivityFeed',
    'app/mybuzz/views/socialAccounts',
    'app/mybuzz/views/facebookFeedPopup',
    'app/mybuzz/views/twitterFeedPopup',
    'app/mybuzz/views/instagramFeedPopup',
    'app/mybuzz/views/soundcloudFeedPopup',
    'app/mybuzz/views/tumblrFeedPopup',
    'app/mybuzz/views/vimeoFeedPopup',
    'app/mybuzz/views/youtubeFeedPopup',
    'app/mybuzz/views/expandedView',
    'app/mybuzz/views/promo'
    ],
function(BaseView, Vent, Config, Tpl, ActivityFeedsCollections, RemixPostModel, FacebookActivityFeed, TwitterActivityFeed, InstagramActivityFeed, TumblrActivityFeed, SoundCloudActivityFeed, VimeoActivityFeed, YoutubeActivityFeed, SocialAccountView, FacebookFeedPopup, TwitterFeedPopup, InstagramFeedPopup, SoundcloudFeedPopup, TumblrFeedPopup, VimeoFeedPopup, YoutubeFeedPopup, ExpandedView, Promo){
    /**
     * Contructor
     * @constructor
     */
    var exports = BaseView.extend({
        /**
         * Compile template
         */
        template : _.template(Tpl),
        /**
         * Use template first child as view element?
         */
        replace : true,
        /**
         * offset value
        **/
        offset : 0,
        /**
         * total number of feeds are available
        **/
        feedsTotalCount : 0,
        /**
         * save feeds
        **/
        feeds : [],
        /**
         * selected layout 
        **/
        selectedLayout : 'flex',
        /**
         *To save next url.
        **/
        nextUrl : '',
        /** 
         * To save total count of feeds
        **/
        estimatedCount : '',
        /** 
         * To save all XHR requests
        **/
        xhrForFeedsCollections : [],
        /**
         * selected account ids
        **/
        selectedAccounts : [],
        /**
         * selected recent activity id
        **/
        selectedRAId : 0,
        /**
         * Animation settings
         */
        animate : {},
        /**
         * Wire up events
         */
        events : {
            'click .parent-li'                      : 'dropDown',
            'click .child-ul li'                    : 'selectOptions',
            'click .filter-icon'                    : 'filterOptions',
            'click .comment'                        : 'openPopup',
            'click .share'                          : 'openPopup',
            'click .like'                           : 'like',
            'click .mobile-search'                  : 'openMobileSearchBox',
            'click #mobile-search-close'            : 'closeMobileSearchBox',
            'click .popup-close-mobile'             : 'closeMobilePopup',
            'click .layout'                         : 'setSelectedLayout',
            'click .post-expanded-view'             : 'expandedView',
            'click #expandedModal'                  : 'closeExpandedView',
            'click .image-popup-close'              : 'closeMobilePopup',
            'click .success-message-close'          : 'closeMessage',
            'click #commentModal'                   : 'closePopup',
            'click .popup-close'                    : 'closePopup',
            'click .close-modal'                    : 'closeModal',
            'keydown'                               : 'closePopupOnEsc',
            'click .accounts-model'                 : 'accountsModelForMobile',
            'click .account-selection-mobile'       : 'selectAccountForMobile',
            'click .conform-selection-of-accounts'  : 'showTheFeedsForSelectedAccounts'
        },
        /**
         * Init stuff
         */
        initialize : function() {
            $(window).scrollTop(0);
            this.prevWidth = $(window).width();

            var self = this;
            // Render my buzz template 
            $(this.el).html(this.template());
            
            this.connections = Backbone.Model.definitions.connections.models[0].attributes.remix_provider.objects;
            // New Activity feeds collection
            this.activityFeedsCollections = new ActivityFeedsCollections;

            // Update connections
            this.updateSocialContacts();

            // Fetch new feeds
            this.fetchFeeds();
            this.reqsent = true;

            Vent.on('PinnedCardToSpotlight',this.showPinnedSuccessMessage);

            Vent.on('UnpinnedCardFromSpotlight',this.showUnpinnedSuccessMessage);

            // Triggers on recent activity is selected
            Vent.on('selectedRAId', this.selectedRAIdFiltered, this);

            // Triggers on selection of accounts
            Vent.on('selectedAccount', this.selectedAccountFiltered, this);

            // Triggers when moving to next view
            this.listenTo(Vent, "app:swapView", this.destroyView);

            // highlight the nav bar
            this.highlightLink(window.location.pathname);
            $(this.el).find('.flexview-icon').addClass('layout-options-bg');

            // To fetch new feeds on bottom scroll
            $(window).scroll(function() {
                if ($(window).scrollTop() + $(window).height() >= $(document).height()-100) {
                    if (self.reqsent){
                        self.reqsent = false;
                        self.fetchFeeds();
                    }
                };
            });
            // QUESTION: Why a listener on the document?
            // This is old one Which is used for closing Grop Fliter and Time Filter
            // $(document).click(function(e){
            //     if (!$(e.target).parents().hasClass('parent-ul')){
            //         $('.child-ul').slideUp();
            //         $('.parent-li').removeClass('add-bg');
            //     }
            // });

            // QUESTION : is this not doable using media queries
            
            $( window ).resize(_.debounce(function(){
                $('.carousel-content, .select-account-mobile-content').empty();
                $('.carousel-content').append("<div class='socialAccounts align-middle' ></div>");
                $('.select-account-mobile-content').append("<div class='account-selection-mobile clearfix select-all-accounts-mobile'><div class='account-name-mobile align-middle'><span>Select All</span></div><div class='selected-account-mobile align-middle'><span class='select-all-accounts'></span></div></div>");
                self.updateSocialContacts();
            }, 500 ));

        },
        
        // To fetch new feeds
        fetchFeeds : function(){   
            var self = this;

            // Get selected account from element 
            if ($('.selected-ra-id').data('selectedAccount')) {
                this.selectedRAId = $('.selected-ra-id').data('selectedAccount');
                $('.provider-icon[data-id='+this.selectedRAId+']').parents('.stat').addClass('layout-options-bg');
                $(this.el).find('.accounts[data-providerId='+this.selectedRAId+']').parent().addClass('active-account');
            };

            // Get selected account from local storage
            if (localStorage.getItem("selectedRAId")) {
                this.selectedRAId = localStorage.getItem("selectedRAId");
            };
        
            // Selected id is there then new feeds are going to fetch
            if (this.selectedRAId != 0) {
                $(this.el).find('.loading-gif').show();
                this.activityFeedsCollections.reset();
                if(self.offset){
                    this.xhrForFeedsCollections.push(this.activityFeedsCollections.fetch({ data:{provider_id: this.selectedRAId, offset: this.offset, exc: this.estimatedCount}}));
                    this.xhrForFeedsCollections[this.xhrForFeedsCollections.length-1].done(function(){
                        self.nextUrl = decodeURIComponent(self.activityFeedsCollections.meta.next);
                        self.urlParse();
                        self.updateFeed();
                        self.feedsTotalCount = self.activityFeedsCollections.meta.total_count;
                    });
                }else{
                    this.xhrForFeedsCollections.push(this.activityFeedsCollections.fetch({ data:{provider_id: this.selectedRAId}}))
                    this.xhrForFeedsCollections[this.xhrForFeedsCollections.length-1].done(function(){
                        self.nextUrl = decodeURIComponent(self.activityFeedsCollections.meta.next);
                        self.urlParse();
                        self.updateFeed();
                        self.feedsTotalCount = self.activityFeedsCollections.meta.total_count;
                    });
                }
            }

            // Selected accounts is there then new feeds are going to fetch
            else if(!$.isEmptyObject($('.selected-accounts').data('selectedAccounts'))){
                $(this.el).find('.loading-gif').show();
                if(self.offset){
                    if (this.connections.length > 0) {
                        this.xhrForFeedsCollections.push(this.activityFeedsCollections.fetch({data:{offset: this.offset, exc: this.estimatedCount, provider_id__in : $('.selected-accounts').data('selectedAccounts').toString()}}));
                        this.xhrForFeedsCollections[this.xhrForFeedsCollections.length-1].done(function(){
                            self.nextUrl = decodeURIComponent(self.activityFeedsCollections.meta.next);
                            self.urlParse();
                            self.updateFeed();
                            self.feedsTotalCount = self.activityFeedsCollections.meta.total_count;
                        });
                    };
                }else{
                    if (this.connections.length > 0) {
                        this.xhrForFeedsCollections.push(this.activityFeedsCollections.fetch({data:{provider_id__in : $('.selected-accounts').data('selectedAccounts').toString()}}))
                        this.xhrForFeedsCollections[this.xhrForFeedsCollections.length-1].done(function(){
                            self.nextUrl = decodeURIComponent(self.activityFeedsCollections.meta.next);
                            self.urlParse();
                            self.updateFeed();
                            self.feedsTotalCount =  self.activityFeedsCollections.meta.total_count;
                        });
                    };
                }
            }
            //if no accounts are slected
            else{
                $(this.el).find('.no-more-feeds').show();
                $(this.el).find('.loading-gif').hide();
            }

            // // New feeds are going to fetch
            // else{
            //     if (this.connections.length > 0) {
            //         $(this.el).find('.loading-gif').show();

            //         this.xhrForFeedsCollections.push(this.activityFeedsCollections.fetch());
            //         this.xhrForFeedsCollections[this.xhrForFeedsCollections.length-1].done(function(){
            //             self.nextUrl = decodeURIComponent(self.activityFeedsCollections.meta.next);
            //             self.urlParse();
            //             self.updateFeed();
            //             self.feedsTotalCount =  self.activityFeedsCollections.meta.total_count;
            //         });
            //     };
            // }

        },

        // Update feeds templates
        updateFeed: function(){
            var self = this;
            var temp = [];
            _.each(this.activityFeedsCollections.models, function(feed){
                this.feeds.push(feed);
                
                _.find(this.connections, function(connection) {
                    if(feed.attributes.provider_id == connection.id){
                        feed.attributes.raw_feed.provider= {name : connection.name, provider : connection.provider}
                    }
                });

                if (feed.attributes.raw_feed.provider){
                    if(feed.attributes.raw_feed.provider.provider == 'facebook') {
                        temp.push($(new FacebookActivityFeed({model : feed.attributes, selectedLayout: this.selectedLayout, fromPage:'MyBuzz'}).render().el).addClass('feed-data'));
                    }else if(feed.attributes.raw_feed.provider.provider == 'twitter') {
                        temp.push($(new TwitterActivityFeed({model : feed.attributes, selectedLayout: this.selectedLayout, fromPage:'MyBuzz'}).render().el).addClass('feed-data'));
                    }else if(feed.attributes.raw_feed.provider.provider == 'instagram') {
                        temp.push($(new InstagramActivityFeed({model : feed.attributes, selectedLayout: this.selectedLayout, fromPage:'MyBuzz'}).render().el).addClass('feed-data'));
                    }else if(feed.attributes.raw_feed.provider.provider == 'tumblr') {
                        temp.push($(new TumblrActivityFeed({model : feed.attributes, selectedLayout: this.selectedLayout, fromPage:'MyBuzz'}).render().el).addClass('feed-data'));
                    }else if (feed.attributes.raw_feed.provider.provider == 'soundcloud') {
                        temp.push($(new SoundCloudActivityFeed({model : feed.attributes, selectedLayout: this.selectedLayout, fromPage:'MyBuzz'}).render().el).addClass('feed-data'));
                    }else if(feed.attributes.raw_feed.provider.provider == 'vimeo') {
                        temp.push($(new VimeoActivityFeed({model : feed.attributes, selectedLayout: this.selectedLayout, fromPage:'MyBuzz'}).render().el).addClass('feed-data'));
                    }else if(feed.attributes.raw_feed.provider.provider == 'youtube'){
                        temp.push($(new YoutubeActivityFeed({model : feed.attributes, selectedLayout: this.selectedLayout, fromPage:'MyBuzz'}).render().el).addClass('feed-data'));
                    }
                    // QUESTION: This is done for every item.
                    // What does this do now that you push the items to a temp array?
                    // Forget to change this now it is fixed 
                    var lastEle = temp.pop();
                    if($(window).width() < 680){
                        if (lastEle.find('.post-left span').length  == 5) {
                            lastEle.find('.post-left span').css('width', "23%");
                        }else if (lastEle.find('.post-left span').length  == 4 || lastEle.find('.post-left span').length  == 3){
                            lastEle.find('.post-left span').css('width', "32%");
                        }else{
                            lastEle.find('.post-left span').css('width', "49%");
                        }
                    }
                    temp.push(lastEle);
                    
                }else{
                    temp.push($(new Promo({model : feed.attributes, selectedLayout: this.selectedLayout}).render().el).addClass('feed-data'));
                }
                this.reqsent = true;
            }, this);

            // Adding all the feed to feeds containing
            if (temp.length > 0)
                $('.feeds').append(temp);

            // Showing info message if there are no more feeds 
            if (this.activityFeedsCollections.models.length == 0) {
                $('.no-more-feeds').show();
            }else{
                $('.no-more-feeds').hide();
            }

            if (this.activityFeedsCollections.models.length == 0 || this.feeds.length > 0){
                $(this.el).find('.loading-gif').hide();
                $(this.el).find('.feeds').removeClass('modal-backdrop');
            }
            
            // QUESTION: Both these do the same thing, no? Why the if?
            // For tablet view freewall is going to execute with 330 width
            // if($(window).width() > 680 && $(window).width() < 1024) {
            //     if (this.selectedLayout == 'flex') {
            //         // this.freewall();
            //         this.flexViewAddOn();
            //     }
            // }else{

            if($(window).width() > 680) {
                
                if (this.selectedLayout == 'flex') {
                    // this.freewall();
                    this.flexViewAddOn();
                };
            }
            
            $(window).bind('resize', function(e){
                window.resizeEvt;
                $(window).resize(function()
                {
                    clearTimeout(window.resizeEvt);
                    window.resizeEvt = setTimeout(function(){
                        if($(window).width() > 680) {
                            if(self.selectedLayout == 'flex'){
                                // self.freewallOnResize(Math.round($('.feeds').width()/Math.round($('.feeds').width()/400)));
                                self.flexViewAddOn();
                            }
                        }
                    }, 250);
                });
            });
            if($('.exapnd-view-add').length > 0){
                $('.mybuzz-nav-bar').addClass('increase-width');
            }
            // TOFIX: this listener shouldn't be here, yields multiple listeners
            // sometimes clicking on play does nothing
            // Also activated multiple times as feeds are loaded
            // Plays only one media at a time
            $("video, audio").unbind("play");
            $("video, audio").on("play", function() {
                $("video, audio").not(this).each(function(index, audio) {
                    audio.pause();
                });
            });
        },

        // To set layout options
        setSelectedLayout: function(e){
            // $('.feeds-content').removeClass('position-relative');
            // $('.feed-data').removeClass('position-absolute');
            // QUESTION: Can this all just be converted to a freewall setting
            // via the number of columns? Why are we rewriting the templates again?
            
            $(e.target).siblings().removeClass('layout-options-bg');
            $(e.target).addClass('layout-options-bg');
            this.selectedLayout = $(e.target).attr('data-selected-layout-option');
            $('.feeds').children().remove();
            $('.feeds').css('height', 0);
            $('.loading-gif').show();
            var temp = [];
            _.each(this.feeds, function(feed){
                
                _.find(this.connections, function(connection) {
                    if(feed.attributes.provider_id == connection.id){
                        feed.attributes.raw_feed.provider= {name : connection.name, provider : connection.provider}
                    }
                });

                if (feed.attributes.raw_feed.provider){
                    if(feed.attributes.raw_feed.provider.provider == 'facebook') {
                        temp.push($(new FacebookActivityFeed({model : feed.attributes, selectedLayout: this.selectedLayout}).render().el).addClass('feed-data'));
                    }else if(feed.attributes.raw_feed.provider.provider == 'twitter') {
                        temp.push($(new TwitterActivityFeed({model : feed.attributes, selectedLayout: this.selectedLayout}).render().el).addClass('feed-data'))
                    }else if(feed.attributes.raw_feed.provider.provider == 'instagram') {
                        temp.push($(new InstagramActivityFeed({model : feed.attributes, selectedLayout: this.selectedLayout}).render().el).addClass('feed-data'))
                    }else if(feed.attributes.raw_feed.provider.provider == 'tumblr') {
                        temp.push($(new TumblrActivityFeed({model : feed.attributes, selectedLayout: this.selectedLayout}).render().el).addClass('feed-data'))
                    }else if (feed.attributes.raw_feed.provider.provider == 'soundcloud') {
                        temp.push($(new SoundCloudActivityFeed({model : feed.attributes, selectedLayout: this.selectedLayout}).render().el).addClass('feed-data'))
                    }else if(feed.attributes.raw_feed.provider.provider == 'vimeo') {
                        temp.push($(new VimeoActivityFeed({model : feed.attributes, selectedLayout: this.selectedLayout}).render().el).addClass('feed-data'))
                    }else if(feed.attributes.raw_feed.provider.provider == 'youtube'){
                        temp.push($(new YoutubeActivityFeed({model : feed.attributes, selectedLayout: this.selectedLayout}).render().el).addClass('feed-data'))
                    }
                    var lastEle = temp.pop();
                    if($(window).width() < 680){
                        if (lastEle.find('.post-left span').length  == 5) {
                            lastEle.find('.post-left span').css('width', "23%");
                        }else if (lastEle.find('.post-left span').length  == 4 || lastEle.find('.post-left span').length  == 3){
                            lastEle.find('.post-left span').css('width', "32%");
                        }else{
                            lastEle.find('.post-left span').css('width', "49%");
                        }
                    }
                    temp.push(lastEle);
                }else{
                    temp.push($(new Promo({model : feed.attributes, selectedLayout: this.selectedLayout}).render().el).addClass('feed-data'));
                }
            }, this);
            
            // Adding all the feed to feeds containing
            if (temp.length > 0)
                $('.feeds').append(temp);

            // Showing info message if there are no more feeds 
            if (this.activityFeedsCollections.models.length == 0) {
                $('.no-more-feeds').show();
            }else{
                $('.no-more-feeds').hide();
            }

            if (this.activityFeedsCollections.models.length == 0 || this.feeds.length > 0){
                $(this.el).find('.loading-gif').hide();
                $(this.el).find('.feeds').removeClass('modal-backdrop');
            }

            if($(window).width() > 680) {
                
                if (this.selectedLayout == 'flex') {
                    // this.freewall();
                    this.flexViewAddOn();
                }else{
                    this.wall.destroy();
                }
            }

            // Plays only one media at a time
            $("video, audio").unbind("play");
            $("video, audio").on("play", function() {
                $("video, audio").not(this).each(function(index, audio) {
                    audio.pause();
                });
            });
        },

        // Initializing freewall
        freewall : function(){
            //Adding set time out to freewall because the elements are not able to find.
            // setTimeout(function(){
                var wall = new freewall(".feeds-content");
                    wall.reset({
                        selector: '.flex-thumbnail-main',
                        animate: true,
                        cellW: function(){
                            return Math.round($('.feeds').width()/Math.round($('.feeds').width()/400));
                        },
                        cellH: 'auto',
                        gutterX: 15,
                        gutterY: 15,
                        onResize: function() {
                            wall.fitWidth();
                        }
                }); 
                wall.fitWidth();
                wall.refresh();
            // }, 500);
        },

        // flex view Add On
        flexViewAddOn : function(){
            var self = this;

            // freewall plugin new code
            if(!this.wall){
                this.wall = new freewall(".feeds-content");
                this.wall.reset({
                    selector: '.flex-thumbnail-main',
                    animate: true,
                    cellW: function(){
                        return Math.round($('.feeds').width()/Math.round($('.feeds').width()/400));
                    },
                    cellH: 'auto',
                    gutterX: 15,
                    gutterY: 15,
                    onResize: function() {
                        self.wall.refresh();
                    }
                }); 
                this.wall.fitWidth();
            }else{
                this.wall.refresh();
            }
            
            // shapeshift plugin
            // if($('.feed-data').length > 0){
            //     $(this.el).find('.feeds-content').addClass('position-relative');
            //     $(this.el).find('.feed-data').addClass('position-absolute');
            //     var windowWidth = $(window).width();
            //     if(windowWidth >= 680 && windowWidth < 1024)
            //         $(this.el).find('.feed-data').css('width', '48%');
            //     else if(windowWidth >= 1024 && windowWidth < 1500)
            //         $(this.el).find('.feed-data').css('width', '32%');
            //     else if(windowWidth >= 1500 && windowWidth < 2000)
            //         $(this.el).find('.feed-data').css('width', '24%');
            //     else if(windowWidth >= 2000 && windowWidth < 2500)
            //         $(this.el).find('.feed-data').css('width', '19%');
            //     else if(windowWidth >= 2500 && windowWidth < 3000)
            //         $(this.el).find('.feed-data').css('width', '15%');
            //     else if(windowWidth >= 3000)
            //         $(this.el).find('.feed-data').css('width', '13%');

            //     $(this.el).find(".feeds-content").shapeshift({
            //         dragClone: false,
            //         enableDrag: false,
            //         enableResize: false,
            //         autoHeight: true,
            //         gutterX: 15, 
            //         gutterY: 15, 
            //         paddingX: 0,
            //         paddingY: 0
            //     });
            // }
        },

        // Accounts view for mobile
        accountsModelForMobile : function(){
            $('.select-account').removeClass('select-this-account');
            _.each(this.selectedAccounts, function(accountId){
                $('.selected-account-mobile').find('.select-account[data-providerid='+accountId+']').addClass('select-this-account');
            })
            $('#select-account-mobile-modal').modal();

            // To Prevent BODY from scrolling when a accounts modal is opened
            $('body').addClass('no-scroll');
            // QUESTION: is this listener ever cleaned up?
            // Remove no-scroll class after closing the modal
            // now removing no-scroll after closing the model
            $('#select-account-mobile-modal').on('hidden.bs.modal', function () {
                $('body').removeClass('no-scroll');
            });
        },

        // Update connections
        updateSocialContacts : function(){
            this.selectedAccounts = [];
            if(localStorage.getItem("selectedRAId")){
                this.selectedRAId = localStorage.getItem("selectedRAId");
                for(var i in this.connections){
                    $('.socialAccounts, .select-account-mobile-content', this.el).append($(new SocialAccountView({model: this.connections[i]}).render().el).addClass('slide'));
                };
            }else if (!$('.selected-accounts').data('selectedAccounts')){
                for(var i in this.connections){
                    this.selectedAccounts.push(parseInt(this.connections[i].id));
                    var el = new SocialAccountView({model: this.connections[i]}).render().el;
                    el = $(el).addClass('slide');
                    $(el).find('.social-connect-profile').addClass('active-account');
                    $('.socialAccounts, .select-account-mobile-content', this.el).append(el);
                };
                $('.selected-accounts').data('selectedAccounts', this.selectedAccounts);
            }else{
                for(var i in this.connections){
                    $('.socialAccounts, .select-account-mobile-content', this.el).append($(new SocialAccountView({model: this.connections[i]}).render().el).addClass('slide'));
                };
            
                if ($('.selected-accounts').data('selectedAccounts')) {
                    var accounts = $('.selected-accounts').data('selectedAccounts')
                    for(var i in accounts){
                        $(this.el).find('.accounts[data-providerId='+accounts[i]+']').parent().addClass('active-account');
                        $(this.el).find('.selected-account-mobile').find('.select-account[data-providerId='+accounts[i]+']').addClass('select-this-account');

                    }
                };
            }
            // QUESTION: Can this be put in a template?
            if($(this.el).find('.slide').length == 0){
                $(this.el).find('.feeds').html('<div class="info-view"><img src="../../../static/images/info.png"><p>You need to add social media connections to use MyBuzz,</p><p>add some now in <a href="/remix/settings" style="color:#50bab9;" data-action="section">Remix Settings.</a></p></div>')
                $('.loading-gif').hide();
            };

            // Initializing BX slider
            if($(window).width() > 680){
                $(this.el).find('.socialAccounts').bxSlider({
                    minSlides: 1,
                    maxSlides: 6,
                    slideWidth: 50,
                    infiniteLoop : false,
                    pager : false,
                    hideControlOnEnd : true,
                });
            }else{
                $(this.el).find('.select-account-mobile-content').find('.active-account').parent().find('.select-account').addClass('select-this-account')
                $(this.el).find('.select-account-mobile-content').find('.slide').removeClass('slide').addClass('account-selection-mobile').find('.active-account').removeClass('active-account');
                if($(this.el).find('.account-selection-mobile').find('.select-this-account').length == $(this.el).find('.account-selection-mobile').find('.select-account').length){
                    $(this.el).find('.select-all-accounts').addClass('selected-all-accounts');
                }
            }

            $('.stat').removeClass('layout-options-bg');
        },

        // To open dropdown for account filter and time filter
        dropDown : function(e){
            $(e.target).parent().find('.child-ul').slideToggle();
            $(e.target).parents('.dropdown').find('.parent-li').toggleClass('add-bg');
        },

        // To set account filter and time filter
        selectOptions : function(e){
            var selector = $(e.target).text();
            $(e.target).parents('.parent-li').find('.all').text(selector);
            $(e.target).parents('.child-ul').hide();
            $('.filter-icon').removeClass('layout-options-bg');
        },

        // Reset all filters
        filterOptions : function(e){
            var nofilter="All";
            var allAccountIds = []
            $(e.target).parents('.mybuzz-nav-bar').find('.all').text(nofilter);
            $('.filter-icon').addClass('layout-options-bg');
            $('.stat').removeClass('layout-options-bg');
            if($(window).width() < 680){
                $('.select-account').addClass('select-this-account')
                var accountMobile = $('.select-account');
                _.each(accountMobile, function(account){
                    if ($.inArray($(account).data('providerid'), allAccountIds) == '-1')
                        allAccountIds.push($(account).data('providerid'));
                },this);
            }else{
                $('.social-connect-profile').addClass('active-account');
                var accounts = $('.accounts');
                _.each(accounts, function(account){
                    if ($.inArray($(account).data('providerid'), allAccountIds) == '-1')
                        allAccountIds.push($(account).data('providerid'));
                },this);
            };
            this.selectedAccountFiltered(allAccountIds);
        },

        // Fetch the feeds based on the selected recent activity 
        selectedRAIdFiltered : function(selectedRAId){
            $(window).scrollTop(0);

            _.each(this.xhrForFeedsCollections,function(xhr){
                if (xhr && xhr.readyState != 4 && xhr.readyState != 0) {
                    xhr.abort();
                };
            });
        
            $('.filter-icon').removeClass('layout-options-bg');
            if(localStorage.getItem("selectedRAId") != selectedRAId){
                localStorage.removeItem("selectedRAId")
            }
            $('.selected-accounts').removeData('selectedAccounts');
            $('.selected-ra-id').removeData('selectedAccount');
            this.feeds = [];
            $('.accounts').parent().removeClass('active-account').addClass('deselected-account')
            $('.accounts[data-providerId='+selectedRAId+']').parent().addClass('active-account');
            $('.selected-account-mobile').find('.select-account').removeClass('select-this-account');
            $('.selected-account-mobile').find('.select-account[data-providerId='+selectedRAId+']').addClass('select-this-account');

            var self = this;
            this.selectedAccounts = [];
            this.selectedRAId = 0;
            this.activityFeedsCollections.reset();
            $('.feeds').children().remove()
            $('.feeds').css('height', 0);
            $(this.el).find('.loading-gif').show();
            this.xhrForFeedsCollections.push(this.activityFeedsCollections.fetch({ data:{provider_id: selectedRAId}}));
            this.xhrForFeedsCollections[this.xhrForFeedsCollections.length-1].done(function(){
                self.nextUrl = decodeURIComponent(self.activityFeedsCollections.meta.next);
                self.urlParse();
                self.selectedRAId = selectedRAId;
                self.feedsTotalCount = self.activityFeedsCollections.meta.total_count;
                self.updateFeed();
            });
        },
        
        // Fetch feeds based on the account selection
        selectedAccountFiltered: function(selectedAccounts){
            $(window).scrollTop(0);

            _.each(this.xhrForFeedsCollections,function(xhr){
                if (xhr && xhr.readyState != 4 && xhr.readyState != 0) {
                    xhr.abort();
                };
            });

            $('.selected-ra-id').removeData('selectedAccount');
            localStorage.removeItem("selectedRAId");
            this.feeds = [];
            var self = this;
            this.selectedAccounts = selectedAccounts;
            $('.selected-accounts').data('selectedAccounts', selectedAccounts);
            this.selectedRAId = 0;
            this.activityFeedsCollections.reset();
            $('.feeds').children().remove()
            $('.feeds').css('height', 0);
            $(this.el).find('.loading-gif').show();

            if (selectedAccounts.length > 0) {
                this.xhrForFeedsCollections.push(this.activityFeedsCollections.fetch({ data:{provider_id__in: selectedAccounts.toString()}}));
                this.xhrForFeedsCollections[this.xhrForFeedsCollections.length-1].done(function(){
                    self.nextUrl = decodeURIComponent(self.activityFeedsCollections.meta.next);
                    self.urlParse();
                    self.selectedAccounts = selectedAccounts;
                    self.feedsTotalCount = self.activityFeedsCollections.meta.total_count;
                    self.updateFeed();
                });
            }else{
                $('.feeds').children().remove()
                self.updateFeed();
            }

            Vent.trigger("socialRemix:account:filter",selectedAccounts);
        },

        // Select account for mobile devices
        selectAccountForMobile : function(e){
            if($(e.currentTarget).find('.select-account').hasClass('select-account')){
                $(e.currentTarget).find('.select-account').toggleClass('select-this-account');
            }else if($(e.currentTarget).find('.select-all-accounts').hasClass('selected-all-accounts')){
                $('.select-account').removeClass('select-this-account');
                $('.select-all-accounts').removeClass('selected-all-accounts');
            }else{
                $('.select-account').addClass('select-this-account');
                $('.select-all-accounts').addClass('selected-all-accounts');
            }

            if($('.select-account-mobile-content').find('.select-this-account').length < this.connections.length){
                $('.select-all-accounts').removeClass('selected-all-accounts');
            }else{
                $('.select-all-accounts').addClass('selected-all-accounts')
            }
            
        },

        // Fetch feeds based on selected accounts 
        showTheFeedsForSelectedAccounts : function(){
            $('.filter-icon').removeClass('layout-options-bg');
            var accounts = $('.select-account-mobile-content').find('.select-account');
            this.selectedAccounts = [];
            _.each(accounts, function(account){
                if($(account).hasClass('select-account select-this-account')){
                    if ($.inArray(parseInt($(account).attr('data-providerid')), this.selectedAccounts) == '-1'){
                        this.selectedAccounts.push(parseInt($(account).attr('data-providerid')));
                    }
                }
            },this);

            $('.stat').removeClass('layout-options-bg')
            $('#select-account-mobile-modal').modal('hide');
            this.selectedAccountFiltered(this.selectedAccounts);
        },

        // Open action popups with slected feed data
        openPopup : function(e){
            var temp = [];
            $('.expanded-view').empty();
            var models = this.feeds;
            var selectedFeedData = _.find(models, function(model) {
                return model.attributes.external_id == $(e.target).attr('data-externalId'); 
            });

            selectedFeedData = selectedFeedData.attributes;

            $('.popups', this.el).empty();
            $('.modal-backdrop').remove();
            if (selectedFeedData.raw_feed.provider.provider == 'facebook') {
                $('.popups', this.el).append(new FacebookFeedPopup({model : selectedFeedData, selectedSocialIcon : $(e.target).attr('data-selected-social-icon')}).render().el);
                this.openPopupLargeScreen();
            }else if (selectedFeedData.raw_feed.provider.provider == 'twitter') {
                $('.popups', this.el).append(new TwitterFeedPopup({model : selectedFeedData, selectedSocialIcon : $(e.target).attr('data-selected-social-icon')}).render().el);
                this.openPopupLargeScreen();
            }else if (selectedFeedData.raw_feed.provider.provider == 'instagram') {
                $('.popups', this.el).append(new InstagramFeedPopup({model : selectedFeedData, selectedSocialIcon : $(e.target).attr('data-selected-social-icon')}).render().el);
                this.openPopupLargeScreen();
            }else if (selectedFeedData.raw_feed.provider.provider == 'soundcloud') {
                $('.popups', this.el).append(new SoundcloudFeedPopup({model : selectedFeedData, selectedSocialIcon : $(e.target).attr('data-selected-social-icon')}).render().el);
                this.openPopupLargeScreen();
            }else if (selectedFeedData.raw_feed.provider.provider == 'tumblr') {
                $('.popups', this.el).append(new TumblrFeedPopup({model : selectedFeedData, selectedSocialIcon : $(e.target).attr('data-selected-social-icon')}).render().el);
                this.openPopupLargeScreen();
            }else if (selectedFeedData.raw_feed.provider.provider == 'vimeo') {
                $('.popups', this.el).append(new VimeoFeedPopup({model : selectedFeedData, selectedSocialIcon : $(e.target).attr('data-selected-social-icon')}).render().el);
                this.openPopupLargeScreen();
            }else if (selectedFeedData.raw_feed.provider.provider == 'youtube') {
                $('.popups', this.el).append(new YoutubeFeedPopup({model : selectedFeedData, selectedSocialIcon : $(e.target).attr('data-selected-social-icon')}).render().el);
                this.openPopupLargeScreen();
            }

            $(this.el).find('#commentModal').height($(window).height());

            // Play only one media at a time
            $("video, audio").unbind("play");
            $("video, audio").on("play", function() {
                $("video, audio").not(this).each(function(index, audio) {
                    audio.pause();
                });
            });
            if ($(window).width() > 1024 ) {
                $('#commentModal').find('.music-band-name').css('max-height', $(window).height()-475);
            };

            // Set action popup height for the mobile devices
            if ($(window).width() < 680 ) {
                $('.popups').find('.mybuzz-popup').css('min-height', $(window).height());
            };
        },

        // Open action popups with fade for desktop without fade for other devices
        openPopupLargeScreen : function(){
            if( $(window).width() > 680 ) {
                $('#commentModal').modal();
            }else{
                $('#commentModal').removeClass('fade');
                $('#commentModal').show();
            }
        },
        
        // Close popups for mobile devices
        closeMobilePopup : function(){
            if($(window).width()<=680){
                $('#commentModal').hide();
                $('.feeds-content').show();
            }
            $('.expanded-view').empty(); 
            $('.fade').hide();
            $('body').removeClass('modal-open');
        },

        // Like a particular feed
        like : function(e){
            var el = $(e.target);
            el.removeClass('like').addClass('cursor-default');
            var models = this.feeds;
            var self = this;
            // _.each(models, function(model){
            // QUESTION: Why aren't we using the collection get instead of find? 
            //  http://backbonejs.org/#Collection-get
            
            var selectedModal = _.find(models, function(model) {
                return model.attributes.external_id == el.attr('data-externalid');
            });
            
            if (selectedModal){
                selectedModal = selectedModal.attributes;

                try {
                    window.analytics.track('Like', {'provider': selectedModal.provider_id});
                } catch(e) {
                    ;
                }  

                // Initializing remix post model          
                var remixPostModel = new RemixPostModel();
                // Send post request for liking a feed
                remixPostModel.save({
                        provider_id: selectedModal.provider_id,
                        action: el.attr('data-selected-social-icon'),
                        params: {
                            reblog_key: el.attr('data-reblog-key'),
                            target_id: selectedModal.processed_feed.id
                        }
                    },
                    {
                        headers : {
                            "X-CSRFToken" : Config.App.csrfmiddlewaretoken
                        }
                    }
                ).done(function(response){
                    $('.success-message').show().append("<div class='notification-pending clearfix' id="+response.task_id+"><p class='message'>Sending '"+el.data('selected-social-icon').charAt(0).toUpperCase()+el.data('selected-social-icon').slice(1)+"' to "+selectedModal.raw_feed.provider.provider.charAt(0).toUpperCase()+selectedModal.raw_feed.provider.provider.slice(1)+"...</p><button type='button' class='success-message-close close'>&times;</button></div>")
                    var counter = 2000;
                    var sendRequest = function(){
                        $.ajax({
                            type: 'GET',
                            url: '../../api/v2/task/'+response.task_id+'/?format=json'
                        })
                        .done(function( msg ) {
                            // Check the status for every 2,4,8,..,30 seconds
                            counter *= 2;
                            if (msg.result == 'PENDING') {
                                if (counter <= 30000){
                                    setTimeout(sendRequest, counter)
                                }else{
                                    sendErrorMessage("Sorry, "+selectedModal.raw_feed.provider.provider.charAt(0).toUpperCase()+selectedModal.raw_feed.provider.provider.slice(1)+" server not responding. Please try your '"+el.attr('data-selected-social-icon').charAt(0).toUpperCase()+el.attr('data-selected-social-icon').slice(1)+"' request again." )
                                }
                            }
                            if(msg.result == 'success'){
                                stopSendingRequest();
                            }else if(msg.result == 'fail'){
                                sendErrorMessage(msg.message);
                            }
                        });
                    }
                    setTimeout(sendRequest, counter);

                    // Stop sending request after success
                    var stopSendingRequest = function(){
                        $('.success-message').show();
                        $('#'+response.task_id).removeClass('notification-pending').addClass('notification-success');
                        if (selectedModal.raw_feed.provider.provider == 'twitter') {
                            selectedModal.processed_feed.favorited = true;
                            $('#'+response.task_id).find('p').html('Favorited Successfully');
                        }else{
                            selectedModal.processed_feed.liked = true;
                            $('#'+response.task_id).find('p').html('Liked Successfully');
                        }

                        el.addClass('onclick-active');
                        
                        // Remove success message after five seconds
                        setTimeout(function(){
                            $('#'+response.task_id).remove();
                            if ($('.success-message').length == 0)
                                $('.success-message').hide();
                        }, 5000);
                    }

                    // Stop sending request after getting an eeror with showing a message
                    var sendErrorMessage = function(msg){
                        $('.success-message').show();
                        el.addClass('like').removeClass('cursor-default');
                        if (selectedModal.raw_feed.provider.provider == 'youtube') {
                            $('#'+response.task_id).removeClass('notification-pending').addClass('notification-error').find('p').html('Error: This video has been removed by the user');

                        }else{
                            $('#'+response.task_id).removeClass('notification-pending').addClass('notification-error').find('p').html(msg);
                        }
                    }
                });
            }
        },

        // Open search box for mobile devices
        openMobileSearchBox : function(){
            $('.mybuzz-navbar-mobile-raw1-content').hide();
            $('.mobile-search-box').show();
        },

        // Close search box for mobile devices
        closeMobileSearchBox : function(){
            $('.mobile-search-box').hide(); 
            $('.mybuzz-navbar-mobile-raw1-content').show();
        },
        
        // Open a larger view for videos and images
        expandedView:function(e){
            $('.expanded-view').empty();
            var models = this.feeds;
            var selectedFeedData = _.find(models, function(model) {
                return model.attributes.external_id == $(e.target).attr('data-externalId'); 
            });

            selectedFeedData = selectedFeedData.attributes;

            var options=[];
            // QUESTION: There is a lot of logic here. why not have it
            // in the ExpandedView so it's clearer
            if (selectedFeedData.raw_feed.provider.provider == 'facebook') {
                if(!$.isEmptyObject(selectedFeedData.processed_feed.content))
                    options={'like':'like','comment':'comment','share':'share','likes':selectedFeedData.raw_feed.likes ?selectedFeedData.raw_feed.likes.data.length :0,'comments':selectedFeedData.raw_feed.comments ? selectedFeedData.raw_feed.comments.data.length :0, 'shared': selectedFeedData.raw_feed.shares ? selectedFeedData.raw_feed.shares.count :0, 'externalId':$(e.target).attr('data-externalId'),'type':$(e.target).attr('data-type'),'provider':selectedFeedData.raw_feed.provider.provider,'image_src':selectedFeedData.processed_feed.content.large_image,'video_src':$(e.target).attr('data-video-src')};
                else
                    options={'like':'like','comment':'comment','share':'share','likes':selectedFeedData.raw_feed.likes ?selectedFeedData.raw_feed.likes.data.length :0,'comments':selectedFeedData.raw_feed.comments ? selectedFeedData.raw_feed.comments.data.length :0, 'shared': selectedFeedData.raw_feed.shares ? selectedFeedData.raw_feed.shares.count :0, 'externalId':$(e.target).attr('data-externalId'),'type':$(e.target).attr('data-type'),'provider':selectedFeedData.raw_feed.provider.provider,'image_src':$(e.target).attr('src'),'video_src':$(e.target).attr('data-video-src')};
            }else if (selectedFeedData.raw_feed.provider.provider == 'twitter') {
                options={'like':'favorite','comment':'reply','share':'retweet','likes':selectedFeedData.raw_feed.favorite_count ?selectedFeedData.raw_feed.favorite_count :0,'shared':selectedFeedData.raw_feed.retweet_count ? selectedFeedData.raw_feed.retweet_count :0,'externalId':$(e.target).attr('data-externalId'),'type':$(e.target).attr('data-type'),'provider':selectedFeedData.raw_feed.provider.provider,'image_src':$(e.target).attr('src'),'video_src':$(e.target).attr('data-video-src')};
            }else if (selectedFeedData.raw_feed.provider.provider == 'instagram') {
                // options={'like':'like','comment':'comment','likes':selectedFeedData.raw_feed.likes.count ?selectedFeedData.raw_feed.likes.count :0,'comments':selectedFeedData.raw_feed.comments.count ? selectedFeedData.raw_feed.comments.count :0,'externalId':$(e.target).attr('data-externalId'),'type':$(e.target).attr('data-type'),'provider':selectedFeedData.raw_feed.provider.provider,'image_src':$(e.target).attr('src'),'video_src':$(e.target).attr('data-video-src')};
                options={'like':'like','comment':'comment','likes':selectedFeedData.raw_feed.likes.count ?selectedFeedData.raw_feed.likes.count :0,'comments':selectedFeedData.raw_feed.comments.count ? selectedFeedData.raw_feed.comments.count :0,'externalId':$(e.target).attr('data-externalId'),'type':$(e.target).attr('data-type'),'provider':selectedFeedData.raw_feed.provider.provider,'image_src':selectedFeedData.raw_feed.images.standard_resolution.url,'video_src':$(e.target).attr('data-video-src')};
            }else if (selectedFeedData.raw_feed.provider.provider == 'soundcloud') {
                
            }else if (selectedFeedData.raw_feed.provider.provider == 'tumblr') {
                if($(e.target).attr('data-type') == 'video')
                    options={'like':'like','comment':'note','share':'retweet','likes':selectedFeedData.raw_feed.like ?selectedFeedData.raw_feed.like :0,'comments':selectedFeedData.raw_feed.note_count ? selectedFeedData.raw_feed.note_count :0,'externalId':$(e.target).attr('data-externalId'),'type':$(e.target).attr('data-type'),'provider':selectedFeedData.raw_feed.provider.provider,'image_src':$(e.target).attr('src'),'video_src': selectedFeedData.raw_feed.player[1].embed_code};
                else
                    options={'like':'like','comment':'note','share':'retweet','likes':selectedFeedData.raw_feed.like ?selectedFeedData.raw_feed.like :0,'comments':selectedFeedData.raw_feed.note_count ? selectedFeedData.raw_feed.note_count :0,'externalId':$(e.target).attr('data-externalId'),'type':$(e.target).attr('data-type'),'provider':selectedFeedData.raw_feed.provider.provider,'image_src':$(e.target).attr('src')};

            }else if (selectedFeedData.raw_feed.provider.provider == 'vimeo') {
                if(selectedFeedData.raw_feed.clip)
                    options={'like':'like', 'comment':'comment', 'share':'share', 'likes': selectedFeedData.raw_feed.clip.metadata.connections.likes.total ? selectedFeedData.raw_feed.clip.metadata.connections.likes.total : 0,'comments':selectedFeedData.raw_feed.clip.metadata.connections.comments.total ? selectedFeedData.raw_feed.clip.metadata.connections.comments.total :0,'externalId':$(e.target).attr('data-externalId'),'type':$(e.target).attr('data-type'),'provider':selectedFeedData.raw_feed.provider.provider,'image_src':$(e.target).attr('src'),'video_src':$(e.target).attr('data-video-src')};
                else
                    options={'like':'like', 'comment':'comment', 'share':'share', 'likes':selectedFeedData.raw_feed.stats.likes ?selectedFeedData.raw_feed.stats.likes :0,'comments':selectedFeedData.raw_feed.stats.comments ? selectedFeedData.raw_feed.stats.comments :0,'externalId':$(e.target).attr('data-externalId'),'type':$(e.target).attr('data-type'),'provider':selectedFeedData.raw_feed.provider.provider,'image_src':$(e.target).attr('src'),'video_src':$(e.target).attr('data-video-src')};
            }else if(selectedFeedData.raw_feed.provider.provider == 'youtube'){
                options={'like':'like', 'comment':'comment', 'likes':0, 'comments':0 ,'externalId':$(e.target).attr('data-externalId'),'type':$(e.target).attr('data-type'),'provider':selectedFeedData.raw_feed.provider.provider,'image_src':$(e.target).attr('src'),'video_src':$(e.target).attr('data-video-src')};
            }
            $('.expanded-view',this.el).append(new ExpandedView({model: selectedFeedData, options : options}).render().el);
            
            $('#expandedModal').modal();

            // Remove feed for mobile devices
            if( $(window).width() < 680 ) {                
                $('#expandedModal').removeClass('fade');
            }
        },

        // Close expanded view
        closeExpandedView:function(e){
            if($(e.target).attr("id")==="expandedModal"){
                $('#expandedModal').empty();   
            }
        },

        // Get the next url parameters 
        urlParse : function(){
            var queryString = [];
            this.nextUrl.replace(
                new RegExp("([^?=&]+)(=([^&]*))?", "g"),
                function($0, $1, $2, $3) { queryString[$1] = $3; }
            );
            this.offset = queryString['offset'];
            this.estimatedCount = queryString['exc'];
        },

        // Close error and success messsage on clicking on close icon
        closeMessage : function(e){
            $(e.target).parent().remove();
            if ($('.success-message').length == 0)
                $('.success-message').hide();
        },

        // Destroy view after going to other page
        destroyView:function(){
            this.remove();
            this.unbind();
            $(window).off('resize');
            $(window).off('scroll');
            Vent.off('PinnedCardToSpotlight');
            Vent.off('UnpinnedCardFromSpotlight');
        },

        // Close action popups
        closePopup:function(e){
            if($(e.target).attr("id") == "commentModal" || $(e.target).hasClass("close")){
                $('.popups').empty(); 
                $('.expanded-view').empty();  
                $('.fade').hide();
                $('body').removeClass('modal-open');
            }
        },

        // Close accounts filter popup
        closeModal : function(){
            $('#select-account-mobile-modal').modal('hide');
        },

        // Close action popup for escape key
        closePopupOnEsc : function(e){
            if (e.keyCode  == 27) {
                $('.popups').empty(); 
                $('.expanded-view').empty(); 
                $('.fade').hide();
                $('body').removeClass('modal-open');
            }
        },

        showPinnedSuccessMessage:function(providerName, pinnedItemId){
            // $('.success-message').empty();
            $('.success-message').show().append("<div class='notification-success clearfix' id="+pinnedItemId+"><p class='message'>Pinned "+providerName+" item successfully</p><button type='button' class='success-message-close close'>&times;</button></div>");
            setTimeout(function(){
                $('#'+pinnedItemId).remove();
                $('#'+pinnedItemId).hide();
            }, 3000);
        },

        showUnpinnedSuccessMessage:function(providerName, unpinnedItemId){
            // $('.success-message').empty();
            $('.success-message').show().append("<div class='notification-success clearfix' id="+unpinnedItemId+"><p class='message'>Unpinned "+providerName+" item successfully</p><button type='button' class='success-message-close close'>&times;</button></div>");
            setTimeout(function(){
                $('#'+unpinnedItemId).remove();
                $('#'+unpinnedItemId).hide();
            }, 3000);
        }
    });

    // Export module
    return exports;
});
